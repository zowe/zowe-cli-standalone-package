const fs = require("fs");
const core = require("@actions/core");
const jsYaml = require("js-yaml");

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
const matrix = [];
for (const [k, v] of Object.entries(zoweVersions.packages)) {
    matrix.push(...["latest", ...Object.keys(v).filter(x => v[x])].map(tag => `${k}:${tag}`));
}
core.setOutput("deploy-matrix", JSON.stringify(matrix.slice(0, 4)));
