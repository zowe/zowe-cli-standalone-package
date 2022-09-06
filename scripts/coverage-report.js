const fs = require("fs");
const path = require("path");
const { pipeline, Readable } = require("stream");
const { promisify } = require("util");
const exec = require("@actions/exec");
const github = require("@actions/github");
const jsYaml = require("js-yaml");
const parseLcov = require("parse-lcov");
const stripComments = require("strip-comments");
const unzipper = require("unzipper");
const xmlJs = require("xml-js");

const artifactCache = {};
const gitCloneCache = {};
const splitAndAppend = (str, delim, count) => {
    // https://stackoverflow.com/questions/5582248/
    const arr = str.split(delim);
    return [...arr.splice(0, count - 1), arr.join(delim)];
}

async function artifactDir(repoName, workflowId, artifactName) {
    let tempDir = artifactCache[`${repoName}/${workflowId}/${artifactName}`];
    if (tempDir == null) {
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
        const [owner, repo] = repoName.split("/");
        const lastSuccessfulRunId = (await octokit.rest.actions.listWorkflowRuns({
            owner, repo,
            workflow_id: workflowId,
            branch: "master",
            status: "success",
            per_page: 1
        })).data.workflow_runs[0].id;
        const artifactData = (await octokit.rest.actions.listWorkflowRunArtifacts({
            owner, repo,
            run_id: lastSuccessfulRunId
        })).data.artifacts.find((a) => a.name === artifactName);
        const artifactRaw = Buffer.from((await octokit.rest.actions.downloadArtifact({
            owner, repo,
            artifact_id: artifactData.id,
            archive_format: "zip"
        })).data);
        tempDir = fs.mkdtempSync(owner);
        await promisify(pipeline)(Readable.from(artifactRaw), unzipper.Extract({ path: tempDir }));
        artifactCache[`${repoName}/${workflowId}/${artifactName}`] = tempDir;
    }
    return tempDir;
}

async function gitCloneDir(repoName) {
    let tempDir = gitCloneCache[repoName];
    if (tempDir == null) {
        tempDir = fs.mkdtempSync(repoName.split("/")[0]);
        await exec.exec("git", ["clone", "--depth", "1", `https://github.com/${repoName}.git`, "."], { cwd: tempDir });
        gitCloneCache[repoName] = tempDir;
    }
    return tempDir;
}

async function checkJunitArtifact(repo, type, workflow, artifact, dirname) {
    const tempDir = await artifactDir(repo, workflow, artifact);
    const junitFile = path.join(tempDir, dirname, "junit.xml");
    const junitInfo = xmlJs.xml2js(fs.readFileSync(junitFile, "utf-8"), { compact: true });
    const numTests = parseInt(junitInfo.testsuites._attributes.tests);
    return { numTests };
};

async function checkLcovArtifact(repo, type, workflow, artifact, dirname) {
    const tempDir = await artifactDir(repo, workflow, artifact);
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

async function checkTestCount(repo, type, tools) {
    const tempDir = await gitCloneDir(repo);
    await exec.exec("npm", ["install", "--ignore-scripts"], { cwd: tempDir });
    const output = await exec.getExecOutput("npm", ["run", `test:${type}`, "--", "--listTests"], { cwd: tempDir });
    let numTests = 0;
    for (const testFile of output.stdout.trim().split("\n").filter(line => line.includes(tempDir))) {
        const testContents = stripComments(fs.readFileSync(testFile, "utf-8"));
        numTests += (testContents.match(/\bit\(/g) || []).length;
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
                switch (covType) {
                    case "junit-artifact":
                        covData = { ...covData, ...await checkJunitArtifact(repoName, testType, ...splitAndAppend(covConfig, "/", 3)) };
                        break;
                    case "lcov-artifact":
                        covData = { ...covData, ...await checkLcovArtifact(repoName, testType, ...splitAndAppend(covConfig, "/", 3)) };
                        break;
                    case "test-count":
                        covData = { ...covData, ...await checkTestCount(repoName, testType, covConfig) };
                        break;
                    default:
                        throw new Error("Unsupported coverage type " + covType);
                }
            }

            if (covData.lineCoverage && covData.branchCoverage) {
                csvLines.push(`${repoName},${testType},${covData.numTests},` +
                    `${covData.lineCoverage},${covData.hitLines}/${covData.foundLines},` +
                    `${covData.branchCoverage},${covData.hitBranches}/${covData.foundBranches}`);
            } else {
                csvLines.push(`${repoName},${testType},${covData.numTests},,,,`);
            }
        }
    }

    fs.writeFileSync(__dirname + "/../coverage-report.csv", csvLines.join("\n"));
    for (const tempDir of [...Object.values(artifactCache), ...Object.values(gitCloneCache)]) {
        fs.rmdirSync(tempDir, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
