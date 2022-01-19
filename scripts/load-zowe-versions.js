const fs = require("fs");
const core = require("@actions/core");
const flat = require("flat");
const jsYaml = require("js-yaml");

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
for (const [k, v] of Object.entries(flat(zoweVersions, { delimiter: "_" }))) {
    core.setOutput(k, v);
}
