/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("@actions/core");
const exec = require("@actions/exec");
const delay = require("delay");
const jsYaml = require("js-yaml");

const utils = require(__dirname + "/utils");

const DRY_RUN = process.env.DRY_RUN === "true";
const PKG_SCOPE = "@zowe";
const SOURCE_REGISTRY = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/";
const TARGET_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org/";
const TEMP_NPM_TAG = "untagged";
const VIEW_OPTS = `--${PKG_SCOPE}:registry=${SOURCE_REGISTRY}`;
const TARGET_OPTS = `--${PKG_SCOPE}:registry=${TARGET_REGISTRY}`;
const FAILED_VERSIONS = [];
const OIDC_NPM_VERSION = "^11.21.0";

async function deploy(pkgName, pkgTag) {
    const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
    if (!Object.keys({ ...zoweVersions.packages, ...zoweVersions.extras }).includes(pkgName)) {
        core.error(`❌ Cannot deploy package ${PKG_SCOPE}/${pkgName} because it is missing from zowe-versions.yaml`);
        return;
    }

    core.info(`📦 Deploying package ${PKG_SCOPE}/${pkgName}@${pkgTag}`);
    fs.rmSync(__dirname + "/../.npmrc", { force: true });
    const pkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, VIEW_OPTS);
    let oldPkgVersion;
    try {
        oldPkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, TARGET_OPTS);
    } catch (err) {
        core.warning(err);  // Do not error out
    }

    if (FAILED_VERSIONS.includes(pkgVersion)) {
        core.warning(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} will not be published because it failed to ` +
            `install`);
        return;
    } else if (oldPkgVersion === pkgVersion && !DRY_RUN) {
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists`);
        return;
    } else if (pkgTag !== pkgVersion && await utils.shouldSkipPublish(pkgName, pkgTag, pkgVersion)) {
        core.warning(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} will not be published until the next Zowe ` +
            `release.\nTo publish it immediately, update the package version in the zowe-versions.yaml file.`);
        return;
    }

    let versionExists = false;
    try {
        oldPkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgVersion}`, TARGET_OPTS);
        versionExists = true;
    } catch (err) {
        core.info(`Could not find package ${PKG_SCOPE}/${pkgName}@${pkgVersion}: ${err.message}`);
    }
    if (versionExists && !DRY_RUN) {
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists, adding tag ${pkgTag}`);
        await utils.execAndGetStderr("npx", [`npm@${OIDC_NPM_VERSION}`, "dist-tag", "add", `${PKG_SCOPE}/${pkgName}@${pkgVersion}`, pkgTag, TARGET_OPTS]);
    } else {
        const pkgSpec = `${PKG_SCOPE}/${pkgName}@${pkgVersion}`;
        const tgzUrl = await utils.getPackageInfo(pkgSpec, VIEW_OPTS, "dist.tarball");
        const fullPkgName = `${pkgName}-${pkgVersion}.tgz`;
        await utils.execAndGetStderr("curl", ["-fsL", "-o", fullPkgName, tgzUrl]);
        const manifest = JSON.parse((await exec.getExecOutput("tar", ["-xOf", fullPkgName, "package/package.json"],
            { silent: true })).stdout);
        if (manifest.publishConfig?.registry != null) {
            core.info(`Repackaging ${pkgSpec} because publishConfig.registry is specified`);
            await utils.execAndGetStderr("bash", ["scripts/repackage_tar.sh", fullPkgName, TARGET_REGISTRY, pkgVersion]);
        } else {
            if (manifest.name !== `${PKG_SCOPE}/${pkgName}` || manifest.version !== pkgVersion) {
                throw new Error(`Cannot mirror ${pkgSpec}: tarball contains ${manifest.name}@${manifest.version}`);
            }
            core.info(`Mirroring ${pkgSpec} unchanged`);
        }
        pkgTag = pkgTag !== pkgVersion ? pkgTag : TEMP_NPM_TAG;
        if (DRY_RUN) return;
        await utils.execAndGetStderr("npx", [`npm@${OIDC_NPM_VERSION}`, "publish", fullPkgName, "--provenance", "false", "--access", "public", "--tag", pkgTag,
            "--registry", TARGET_REGISTRY, TARGET_OPTS]);
    }

    core.info("Waiting for published version to appear on NPM registry");
    let taggedVersion;
    versionExists = false;
    while (!versionExists || taggedVersion !== pkgVersion) {
        if (!versionExists) {
            versionExists = (await exec.getExecOutput("npm", ["view", `${PKG_SCOPE}/${pkgName}@${pkgVersion}`,
                "version", TARGET_OPTS], { ignoreReturnCode: true })).stdout.trim().length > 0;
        } else {
            taggedVersion = (await exec.getExecOutput("npm", ["view", `${PKG_SCOPE}/${pkgName}@${pkgTag}`,
                "version", TARGET_OPTS], { ignoreReturnCode: true })).stdout.trim();
        }
        await delay(1000);
    }
    let isUntagged = false;
    if (pkgTag === TEMP_NPM_TAG) {  // Remove temporary npm tag because npm forces us to publish with dist-tag
        isUntagged = true;
        await utils.execAndGetStderr("npx", [`npm@${OIDC_NPM_VERSION}`, "dist-tag", "rm", `${PKG_SCOPE}/${pkgName}`, TEMP_NPM_TAG, TARGET_OPTS]);
    }

    core.info("Verifying that deployed package can be installed");
    let installError;
    try {
        await utils.execAndGetStderr("npm", ["install", `${PKG_SCOPE}/${pkgName}@${isUntagged ? pkgVersion : pkgTag}`,
            `--${PKG_SCOPE}:registry=${TARGET_REGISTRY}`], { cwd: fs.mkdtempSync(os.tmpdir() + "/zowe") })
    } catch (err) {
        installError = err;
    }
    if (installError != null) {
        if (oldPkgVersion != null && !isUntagged) {
            core.info(`Install failed, reverting tag ${pkgTag} to v${oldPkgVersion}`);
            await exec.exec("npx", [`npm@${OIDC_NPM_VERSION}`, "dist-tag", "add", `${PKG_SCOPE}/${pkgName}@${oldPkgVersion}`, pkgTag, TARGET_OPTS], { ignoreReturnCode: true });
        }
        FAILED_VERSIONS.push(pkgVersion);
        throw installError;
    }
}

(async () => {
    const pkgName = process.argv[2];
    const pkgTags = process.argv.slice(3);
    const deployErrors = {};
    let deployDecisions = {};

    try {
        deployDecisions = JSON.parse(fs.readFileSync(path.join(process.cwd(), "publish-list.json")).toString());
    } catch (err) {
        // Do nothing
    }


    for (const pkgTag of pkgTags) {
        if (deployDecisions[pkgName] != undefined && deployDecisions[pkgName][pkgTag] == false) {
            // Don't deploy this package
            core.error(`Skipping deployment: ${PKG_SCOPE}/${pkgName}@${pkgTag}`);
            continue;
        }
        try {
            await deploy(pkgName, pkgTag);
        } catch (err) {
            deployErrors[pkgTag] = err;
            core.error(err);
        }
    }

    if (Object.keys(deployErrors).length > 0) {
        let errorReport = "";
        for (const [k, v] of Object.entries(deployErrors)) {
            errorReport += `[${k}] ${v.stack}\n\n`;
        }
        core.setOutput("errors", errorReport.trim());
        core.setFailed(new AggregateError(Object.values(deployErrors)));
        process.exit(1);
    }
})();
