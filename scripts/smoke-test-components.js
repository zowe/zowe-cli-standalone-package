
const core = require("@actions/core");
const utils = require(__dirname + "/utils");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yaml = require("js-yaml");

const PKG_SCOPE = "@zowe";
const errors = [];

async function test(pkgName, pkgTag) {
    core.info(`Verifying that package ${pkgName} with tag ${pkgTag} can be installed`);
    let installError;
    const tempDir = fs.mkdtempSync(os.tmpdir() + "/zowe");
    
    try {
        // First try with npm-local-release registry
        await utils.execAndGetStderr("npm", ["config", "set", `${PKG_SCOPE}:registry`, "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/"],
            { cwd: tempDir });
        await utils.execAndGetStderr("npm", ["install", `${PKG_SCOPE}/${pkgName}@${pkgTag}`],
            { cwd: tempDir });
    } catch (err) {
        core.warning(`Failed to install ${PKG_SCOPE}/${pkgName}@${pkgTag} from npm-local-release: ${err.message}`);
        
        try {
            // Fallback: Configure npm to also use npm-release registry and try again
            core.info(`Trying fallback registry for ${PKG_SCOPE}/${pkgName}@${pkgTag}`);
            await utils.execAndGetStderr("npm", ["config", "set", `${PKG_SCOPE}:registry`, "https://zowe.jfrog.io/zowe/api/npm/npm-release/"],
                { cwd: tempDir });
            await utils.execAndGetStderr("npm", ["install", `${PKG_SCOPE}/${pkgName}@${pkgTag}`],
                { cwd: tempDir });
        } catch (fallbackErr) {
            installError = fallbackErr;
            core.error(`Both registries failed for ${PKG_SCOPE}/${pkgName}@${pkgTag}: ${installError.message}`);
            errors.push(`Primary error: ${err.stack}\nFallback error: ${fallbackErr.stack}`);
            return false;
        }
    }
    return true;
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
    const yamlFile = yaml.load(fs.readFileSync(path.join(process.cwd(), "zowe-versions.yaml")));
    const extraNames = Object.keys(yamlFile.extras);
    const results = [];

    // Run tests and collect information
    for (const {name, tag} of tags) {
        let success;
        if (process.env.SKIP_SDKS && (!name.endsWith("cli") || extraNames.includes(name))) {
            // Just skip it
            continue;
        }

        if (process.arch == "arm64" && name == "db2-for-zowe-cli") {
            // Don't even try, we don't expect this to work
            success = false;
        } else {
            success = await test(name, tag);
        }
        results.push({
            arch: process.arch,
            platform: process.platform,
            package: name,
            tag: tag,
            success: success,
            compare: `${name}_${tag}_${process.platform}_${process.arch}`
        });
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
