
const core = require("@actions/core");
const utils = require(__dirname + "/utils");
const fs = require("fs");
const path = require("path");

const PKG_SCOPE = "@zowe";
const SOURCE_REGISTRY = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/";
const errors = [];

async function test(pkgName, pkgTag) {
    core.info(`Verifying that package ${pkgName} with tag ${pkgTag} can be installed`);
    let installError;
    try {
        await utils.execAndGetStderr("npm", ["install", `${PKG_SCOPE}/${pkgName}@${pkgTag}`,
            `--${PKG_SCOPE}:registry=${SOURCE_REGISTRY}`], { cwd: fs.mkdtempSync(os.tmpdir() + "/zowe") });
        return true;
    } catch (err) {
        installError = err;
        errors.push(installError);
        return false;
    }
}

function getTags(tagArray) {
    tagList = JSON.parse(tagArray);
    const ourPackages = [];
    for (const item of tagList) {
        const [packageName, ...pkgTags] = item.split(" ");
        for (const tag of pkgTags) {
            const package = {
                name: packageName,
                tag: tag
            }
            ourPackages.push(package);
        }
    }
    return ourPackages;
}

(async () => {
    const tags = getTags(process.env.DEPLOY_MATRIX);
    const results = [];
    // Run tests and collect information
    for (const {name, tag} of tags) {
        const success = await test(name, tag);
        results.push({arch: process.arch, platform: process.platform, package: name, tag: tag, success: success});
    }

    // Output the artifact
    fs.writeFileSync(path.join(process.cwd(), `status-${process.env.RUN_OS}.json`), JSON.stringify(results, null, 4));
    
    // Add additional artifacts if something went wrong and exit.
    if (errors.length > 0) {
        const errorFile = fs.openSync(path.join(process.cwd(), `errors-${process.env.RUN_OS}.log`), "a");
        for (const error of errors) {
            fs.appendFileSync(errorFile, JSON.stringify(error, null, 4) + "\n");
        }
        fs.closeSync(errorFile);
        process.exit(1);
    }
})();
