const fs = require("fs");
const os = require("os");
const core = require("@actions/core");
const exec = require("@actions/exec");
const delay = require("delay");
const jsYaml = require("js-yaml");
const moment = require("moment");
const fetch = require("node-fetch");
const { serializeError } = require("serialize-error");

const PKG_SCOPE = "@zowe";
const SOURCE_REGISTRY = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/";
const TARGET_REGISTRY = process.env.NPM_REGISTRY || "https://registry.npmjs.org/";
const VIEW_OPTS = `--${PKG_SCOPE}:registry=${SOURCE_REGISTRY}`;

async function getPackageInfo(pkg, opts="", prop="version") {
    core.info(`Getting '${prop}' for package: ${pkg}`);
    const viewArgs = ["view", pkg, prop];
    if (opts) {
        viewArgs.push(opts);
    }
    let cmdOutput;
    try {
        cmdOutput = (await exec.getExecOutput("npm", viewArgs)).stdout.trim();
    } catch {
        throw new Error(`Package not found: ${pkg}`);
    }
    if (cmdOutput.length === 0) {
        throw new Error(`Property not found: ${prop}`);
    }
    return cmdOutput;
}

async function shouldSkipPublish(pkgName, pkgTag, pkgVersion) {
    const response = await fetch("https://raw.githubusercontent.com/zowe/zowe.github.io/master/_data/releases.yml", {
        headers: (process.env.CI && !process.env.ACT) ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}
    });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const releasesData = jsYaml.load(await response.text());

    const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
    const isStaging = zoweVersions.tags["zowe-v1-lts"].version > releasesData[0].version;
    if (!isStaging || zoweVersions.packages[pkgName] == null) {
        return false;
    }

    if (pkgTag === "latest") {
        // For latest tag, we assume it is aliased with the first tag defined for the package
        pkgTag = Object.keys(zoweVersions.packages[pkgName])[0];
    }

    if (pkgTag !== "next") {
        return pkgVersion > zoweVersions.packages[pkgName]["zowe-v1-lts"];
    } else {
        const dateString = pkgVersion.split(".").pop();
        const pkgDate = moment(`${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`);
        return pkgDate.isAfter(moment(zoweVersions.tags.next.snapshot));
    }
}

async function deploy(pkgName, pkgTag) {
    core.info(`📦 Deploying package ${PKG_SCOPE}/${pkgName}@${pkgTag}`);
    fs.rmSync(__dirname + "/../.npmrc", { force: true });
    const pkgVersion = await getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, VIEW_OPTS);
    let oldPkgVersion;
    try {
        oldPkgVersion = await getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`);
    } catch (err) {
        core.warning(err);  // Do not error out
    }

    if (oldPkgVersion === pkgVersion) {
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists`);
        return;
    } else if (await shouldSkipPublish(pkgName, pkgTag, pkgVersion)) {
        core.warning(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} will not be published until the next Zowe release.\n` +
            `To publish it immediately, update the package version in the zowe-versions.yaml file.`);
        return;
    }

    try {
        oldPkgVersion = await getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgVersion}`);
        core.info(`Package ${PKG_SCOPE}/${pkgName}@${pkgVersion} already exists, adding tag ${pkgTag}`);
        await exec.exec("npm", ["dist-tag", "add", `${PKG_SCOPE}/${pkgName}@${pkgVersion}`, pkgTag]);
    } catch (err) {
        const tgzUrl = await getPackageInfo(`${PKG_SCOPE}/${pkgName}@${pkgTag}`, VIEW_OPTS, "dist.tarball");
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
