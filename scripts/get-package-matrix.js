const fs = require("fs");
const core = require("@actions/core");
const jsYaml = require("js-yaml");

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
const matrix = [];
for (const [k, v] of Object.entries({ ...zoweVersions.packages, ...zoweVersions.extras })) {
    matrix.push([k, "latest", ...Object.keys(v).filter(x => v[x])].join(" "));
}
core.setOutput("deploy-matrix", JSON.stringify(matrix));
