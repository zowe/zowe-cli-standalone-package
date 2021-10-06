const fs = require("fs");
const core = require("@actions/core");
const jsYaml = require("js-yaml");

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
const outputs = { zowe: zoweVersions.zowe };
for (const [k, v] of Object.entries(zoweVersions["zowe-cli"])) {
    outputs[`zowe-${k}`] = v;
}
for (const [k, v] of Object.entries(zoweVersions["zowe-sdk"])) {
    outputs[`zowe-${k}-sdk`] = v;
}
for (const [k, v] of Object.entries(zoweVersions["zowe-plugins"])) {
    outputs[`zowe-${k}-plugin`] = v;
}
for (const [k, v] of Object.entries(outputs)) {
    core.setOutput(k, v);
}
