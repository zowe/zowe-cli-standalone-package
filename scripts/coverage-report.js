const fs = require("fs");
const path = require("path");
const exec = require("@actions/exec");
const { XMLParser } = require("fast-xml-parser");
const jsYaml = require("js-yaml");
const parseLcov = require("parse-lcov");
const stripComments = require("strip-comments");

const artifactCache = {};
const gitCloneCache = {};
const splitAndAppend = (str, delim, count) => {
    // https://stackoverflow.com/questions/5582248/
    const arr = str.split(delim);
    return [...arr.splice(0, count - 1), arr.join(delim)];
}

async function artifactDir(repoSpec, workflowId, artifactName) {
    const [repoName, branchName] = repoSpec.split("#");
    const cacheKey = `${repoName}/${workflowId}/${artifactName}`;
    let tempDir = artifactCache[cacheKey];
    if (tempDir == null) {
        const listArgs = ["--branch", branchName ?? "master", "--json", "databaseId", "--limit", "1", "--repo",
            repoName, "--status", "success", "--workflow", workflowId];
        const listResult = await exec.getExecOutput("gh", ["run", "list", ...listArgs]);
        const lastSuccessfulRunId = JSON.parse(listResult.stdout)[0].databaseId;

        tempDir = fs.mkdtempSync(repoName.split("/")[0]);
        const downloadArgs = [lastSuccessfulRunId, "--dir", tempDir, "--name", artifactName, "--repo", repoName];
        const downloadResult = await exec.getExecOutput("gh", ["run", "download", ...downloadArgs],
            { ignoreReturnCode: true });
        if (downloadResult.exitCode !== 0) {
            const message = downloadResult.stderr.trim();
            fs.rmSync(tempDir, { recursive: true, force: true });
            if (message.includes("no valid artifacts found to download")) {
                return;  // Ignore error if artifact has expired
            }
            throw new Error(`gh run download failed with exit code ${downloadResult.exitCode}: ${message}`);
        }
        artifactCache[cacheKey] = tempDir;
    }
    return tempDir;
}

async function gitCloneDir(repoSpec) {
    const [repoName, branchName] = repoSpec.split("#");
    let tempDir = gitCloneCache[repoName];
    if (tempDir == null) {
        tempDir = fs.mkdtempSync(repoName.split("/")[0]);
        await exec.exec("git", ["clone", "--branch", branchName ?? "master", "--depth", "1",
            `https://github.com/${repoName}.git`, "."], { cwd: tempDir });
        gitCloneCache[repoName] = tempDir;
    }
    return tempDir;
}

async function checkJunitArtifact(repo, type, workflow, artifact, dirname) {
    const tempDir = await artifactDir(repo, workflow, artifact);
    if (tempDir == null) {
        return {};
    }
    const junitFiles = [];
    if (type === "wdio") {
        junitFiles.push(...fs.globSync(path.join(tempDir, dirname, "wdio-*-junit-reporter.log")));
    } else {
        junitFiles.push(dirname.endsWith(".xml") ? path.join(tempDir, dirname) :
            path.join(tempDir, dirname, "junit.xml"));
    }
    const parser = new XMLParser({ ignoreAttributes: false });
    const numTests = junitFiles.reduce((sum, filePath) => {
        const junitInfo = parser.parse(fs.readFileSync(filePath, "utf-8"));
        return sum + parseInt(junitInfo.testsuites["@_tests"]);
    }, 0);
    return { numTests };
};

async function checkLcovArtifact(repo, type, workflow, artifact, dirname) {
    const tempDir = await artifactDir(repo, workflow, artifact);
    if (tempDir == null) {
        return {};
    }
    const lcovFile = path.join(tempDir, dirname, "lcov.info");
    const lcovInfo = parseLcov.default(fs.readFileSync(lcovFile, "utf-8"));
    let foundLines = 0;
    let hitLines = 0;
    let foundBranches = 0;
    let hitBranches = 0;
    for (const { lines, branches } of lcovInfo) {
        foundLines += lines.found;
        hitLines += lines.hit;
        foundBranches += branches.found;
        hitBranches += branches.hit;
    }
    const lineCoverage = (hitLines / foundLines * 100).toFixed(2);
    const branchCoverage = (hitBranches / foundBranches * 100).toFixed(2);
    return { lineCoverage, hitLines, foundLines, branchCoverage, hitBranches, foundBranches };
};

async function checkTestCount(repo, type, tools, ...subDirs) {
    const tempDir = await gitCloneDir(repo);
    await exec.exec("npm", ["install", "--ignore-scripts", "--silent"], { cwd: tempDir });
    let numTests = 0;
    for (const subDir of (subDirs.length ? subDirs : [""])) {
        const output = await exec.getExecOutput("npm", ["run", `test:${type}`, "--", "--listTests"],
            { cwd: path.join(tempDir, subDir) });
        for (const testFile of output.stdout.trim().split("\n").filter(line => line.includes(tempDir))) {
            const testContents = stripComments(fs.readFileSync(testFile, "utf-8"));
            numTests += (testContents.match(/\bit\(/g) || []).length;
        }
    }
    return { numTests };
};

(async () => {
    const config = jsYaml.load(fs.readFileSync(__dirname + "/../coverage-config.yaml", "utf-8"));
    const csvLines = ["Project,Test Type,# Tests,% Line Coverage,Covered Lines,% Branch Coverage,Covered Branches"];

    for (const [repoName, repoConfig] of Object.entries(config.projects)) {
        for (const [testType, testConfig] of Object.entries(repoConfig)) {
            let covData = {};
            for (const [covType, covConfig] of Object.entries(testConfig)) {
                console.log(`${repoName} > ${testType} > ${covType}`);
                switch (covType) {
                    case "junit-artifact":
                        covData = { ...covData, ...await checkJunitArtifact(repoName, testType, ...splitAndAppend(covConfig, "/", 3)) };
                        break;
                    case "lcov-artifact":
                        covData = { ...covData, ...await checkLcovArtifact(repoName, testType, ...splitAndAppend(covConfig, "/", 3)) };
                        break;
                    case "test-count":
                        covData = { ...covData, ...await checkTestCount(repoName, testType, ...covConfig.split(/[:,]/)) };
                        break;
                    case "wdio-artifact":
                        covData = { ...covData, ...await checkJunitArtifact(repoName, "wdio", ...splitAndAppend(covConfig, "/", 3)) };
                        break;
                    default:
                        throw new Error("Unsupported coverage type " + covType);
                }
            }

            if (covData.lineCoverage && covData.branchCoverage) {
                csvLines.push(`${repoName.split("#")[0]},${testType},${covData.numTests},` +
                    `${covData.lineCoverage},${covData.hitLines}/${covData.foundLines},` +
                    `${covData.branchCoverage},${covData.hitBranches}/${covData.foundBranches}`);
            } else {
                csvLines.push(`${repoName.split("#")[0]},${testType},${covData.numTests ?? "-"},,,,`);
            }
        }
    }

    fs.writeFileSync(__dirname + "/../coverage-report.csv", csvLines.join("\n"));
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    for (const tempDir of [...Object.values(artifactCache), ...Object.values(gitCloneCache)]) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
