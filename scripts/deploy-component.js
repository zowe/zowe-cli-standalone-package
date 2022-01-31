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
const core = require("@actions/core");
const exec = require("@actions/exec");
const delay = require("delay");
const jsYaml = require("js-yaml");
const moment = require("moment");
const fetch = require("node-fetch");
const { serializeError } = require("serialize-error");

const utils = require(__dirname + "/utils");

const PKG_SCOPE = "@zowe";
const SOURCE_REGISTRY = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/";
const TARGET_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org/";
const VIEW_OPTS = `--${PKG_SCOPE}:registry=${SOURCE_REGISTRY}`;

async function deploy(pkgName, pkgTag) {
    core.info(`📦 Deploying package ${PKG_SCOPE}/${pkgName}@${pkgTag}`);
    fs.rmSync(__dirname + "/../.npmrc", { force: true });
    const pkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, VIEW_OPTS);
    let oldPkgVersion;
    try {
        oldPkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`);
    } catch (err) {
        core.warning(err);  // Do not error out
    }

    if (oldPkgVersion === pkgVersion) {
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists`);
        return;
    } else if (await utils.shouldSkipPublish(pkgName, pkgTag, pkgVersion)) {
        core.warning(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} will not be published until the next Zowe release.\n` +
            `To publish it immediately, update the package version in the zowe-versions.yaml file.`);
        return;
    }

    try {
        oldPkgVersion = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgVersion}`);
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists, adding tag ${pkgTag}`);
        await exec.exec("npm", ["dist-tag", "add", `${PKG_SCOPE}/${pkgName}@${pkgVersion}`, pkgTag]);
    } catch (err) {
        const tgzUrl = await utils.getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, VIEW_OPTS, "dist.tarball");
        const fullPkgName = `${pkgName}-${pkgVersion}.tgz`;
        await exec.exec("curl", ["-fs", "-o", fullPkgName, tgzUrl]);
        await exec.exec("bash", ["scripts/repackage_tar.sh", fullPkgName, TARGET_REGISTRY, pkgVersion]);
        const publishArgs = ["publish", fullPkgName, "--access", "public"];
        if (pkgTag !== pkgVersion) {
            publishArgs.push("--tag", pkgTag);
        }
        await exec.exec("npm", publishArgs);
    }

    core.info("Waiting for published version to appear on NPM registry");
    let taggedVersion;
    while (taggedVersion !== pkgVersion) {
        await delay(1000);
        taggedVersion = (await exec.getExecOutput("npm", ["view", `${PKG_SCOPE}/${pkgName}@${pkgTag}`, "version"])).stdout.trim();
    }

    core.info("Verifying that deployed package can be installed");
    let installError;
    try {
        await exec.exec("npm", ["install", `${PKG_SCOPE}/${pkgName}@${pkgTag}`, `--${PKG_SCOPE}:registry=${TARGET_REGISTRY}`],
            { cwd: fs.mkdtempSync(os.tmpdir() + "/zowe") })
    } catch (err) {
        installError = err;
    }
    if (installError != null) {
        if (oldPkgVersion != null) {
            core.info(`Install failed, reverting tag ${pkgTag} to v${oldPkgVersion}`);
            await exec.exec("npm", ["dist-tag", "add", `${PKG_SCOPE}/${pkgName}@${oldPkgVersion}`, pkgTag]);
        }
        throw installError;
    }
}

(async () => {
    const pkgName = process.argv[2];
    const pkgTags = process.argv.slice(3);
    const deployErrors = {};

    for (const pkgTag of pkgTags) {
        try {
            await deploy(pkgName, pkgTag);
        } catch (err) {
            deployErrors[pkgTag] = err;
            core.error(err);
        }
    }

    if (Object.keys(deployErrors).length > 0) {
        const errorReport = {};
        for (const [k, v] of Object.entries(deployErrors)) {
            errorReport[k] = serializeError(v);
        }
        core.setOutput("errors", jsYaml.dump(errorReport));
        core.setFailed(new AggregateError(Object.values(deployErrors)));
        process.exit(1);
    }
})();