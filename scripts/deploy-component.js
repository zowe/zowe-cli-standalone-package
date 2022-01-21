const fs = require("fs");
const os = require("os");
const core = require("@actions/core");
const exec = require("@actions/exec");
const delay = require("delay");
const jsYaml = require("js-yaml");
const moment = require("moment");
const fetch = require("node-fetch");

const pkgScope = "@zowe";
const sourceRegistry = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/";
const targetRegistry = "https://registry.npmjs.org/";
const viewOpts = `--${pkgScope}:registry=${sourceRegistry}`;

async function getPackageInfo(pkg, opts="", prop="version") {
    core.info(`Getting '${prop}' for package: ${pkg}`);
    const rc = await exec.exec("npm", ["view", pkg, opts], { ignoreReturnCode: true });
    if (rc === 0) {
        return (await exec.getExecOutput("npm", ["view", pkg, prop, opts])).stdout.trim();
    } else {
        throw new Error(`Package not found: ${pkg}`);
    }
}

function npmLogin() {
    throw new Error("Not yet implemented");
    const lines = [
        `//${targetRegistry.replace(/^http(s):\/\//, "")}:_authToken=${process.env.NPM_TOKEN}`,
        `registry=${targetRegistry}`
    ];
    fs.appendFileSync(os.homedir() + "/.npmrc", lines.join("\n"));
}

async function shouldSkipPublish(pkgName, pkgTag, pkgVersion) {
    const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
    const releasesYaml = await fetch("https://raw.githubusercontent.com/zowe/zowe.github.io/master/_data/releases.yml", {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    });
    const releasesData = jsYaml.load(releasesYaml.body);
    const isStaging = zoweVersions["zowe-v1-lts"].version > releasesData[0].version;
    if (!isStaging) {
        return false;
    } else if (pkgTag !== "next") {
        const stagedVersion = zoweVersions.packages[pkgName];
        return pkgVersion > stagedVersion;
    } else {
        const dateString = pkgVersion.split(".").pop();
        const pkgDate = moment(`${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`);
        return pkgDate.isSameOrAfter(moment().startOf("day"));
    }
}

(async () => {
    const pkgName = process.argv[2];
    const pkgTag = process.argv[3];
    fs.rmSync(__dirname + "/../.npmrc", { force: true });

    const pkgVersion = await getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`, viewOpts, "version");
    if (shouldSkipPublish(pkgName, pkgTag, pkgVersion)) {
        core.info(`Package ${pkgScope}/${pkgName}@${pkgVersion} will not be published until the next Zowe release.\n` +
            `To publish it immediately, update the package version in the zowe-versions.yaml file.`);
        process.exit();
    }

    const tgzUrl = await getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`, viewOpts, "dist.tarball");
    const fullPkgName = `${pkgName}-${pkgVersion}.tgz`;
    await exec.exec("curl", ["-fs", "-o", fullPkgName, tgzUrl]);

    npmLogin();
    let oldPkgVersion;
    try {
        oldPkgVersion = await getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`);
    } catch (err) {
        core.warning(err);  // Do not error out
    }

    let versionsMatch = true;
    if (oldPkgVersion === pkgVersion) {
        core.info(`Package ${pkgScope}/${pkgName}@${pkgVersion} already exists`);
        process.exit();
    }

    try {
        oldPkgVersion = await getPackageInfo(`${pkgScope}/${pkgName}@${pkgVersion}`);
        core.info(`Package ${pkgScope}/${pkgName}@${pkgVersion} already exists, adding tag ${pkgTag}`);
        await exec.exec("npm", ["dist-tag", "add", `${pkgScope}/${pkgName}@${pkgVersion}`, pkgTag]);
    } catch (err) {
        versionsMatch = false;
        await exec.exec("bash", ["scripts/repackage_tar.sh", fullPkgName, targetRegistry, pkgVersion]);
        const publishOpts = ["publish", fullPkgName, "--access", "public"];
        if (pkgTag !== pkgVersion) {
            publishOpts.push("--tag", pkgTag);
        }
        await exec.exec("npm", publishOpts);
    }

    core.info("Waiting for published version to appear on NPM registry");
    let taggedVersion;
    while (taggedVersion !== pkgVersion) {
        await delay(1000);
        taggedVersion = (await exec.getExecOutput("npm", ["view", `${pkgScope}/${pkgName}@${pkgTag}`, "version"])).stdout.trim();
    }

    core.info("Verifying that deployed package can be installed");
    let installError;
    try {
        await exec.exec("npm", ["install", `${pkgScope}/${pkgName}@${pkgTag}`, `--${pkgScope}:registry=${targetRegistry}`],
            { cwd: fs.mkdtempSync("zowe") })
    } catch (err) {
        installError = err;
    }
    if (installError != null) {
        if (oldPkgVersion != null) {
            core.info(`Install failed, reverting tag ${pkgTag} to v${oldPkgVersion}`);
            await exec.exec("npm", ["dist-tag", "add", `${pkgScope}/${pkgName}@${oldPkgVersion}`, pkgTag]);
        }
        throw installError;
    }
})().catch((err) => {
    core.setOutput("error", err.stack);
    core.setFailed(err);
    process.exit(1);
});
