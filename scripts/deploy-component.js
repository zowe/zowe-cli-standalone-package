const fs = require("fs");
const os = require("os");
const core = require("@actions/core");
const exec = require("@actions/exec");
const delay = require("delay");

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

(async () => {
    const pkgName = process.argv[2];
    const pkgTag = process.argv[3];
    fs.rmSync(__dirname + "/../.npmrc", { force: true });

    const pkgVersion = getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`, viewOpts, "version");
    const tgzUrl = getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`, viewOpts, "dist.tarball");
    const fullPkgName = `${pkgName}-${pkgVersion}.tgz`;
    await exec.exec("curl", ["-fs", "-o", fullPkgName, tgzUrl]);

    npmLogin();
    let oldPkgVersion;
    try {
        oldPkgVersion = getPackageInfo(`${pkgScope}/${pkgName}@${pkgTag}`);
    } catch (err) {
        core.warning(err);  // Do not error out
    }

    let versionsMatch = true;
    if (oldPkgVersion === pkgVersion) {
        core.info(`Package ${pkgScope}/${pkgName}@${pkgVersion} already exists`);
        process.exit();
    }

    try {
        oldPkgVersion = getPackageInfo(`${pkgScope}/${pkgName}@${pkgVersion}`);
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
            echo `Install failed, reverting tag ${pkgTag} to v${oldPkgVersion}`;
            await exec.exec("npm", ["dist-tag", "add", `${pkgScope}/${pkgName}@${oldPkgVersion}`, pkgTag]);
        }
        throw installError;
    }
})().catch((err) => {
    core.setOutput("error", err.stack);
    core.setFailed(err);
    process.exit(1);
});
