/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

const fs = require("fs");
const core = require("@actions/core");
const jsYaml = require("js-yaml");

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
const matrix = [];
for (const [k, v] of Object.entries({ ...zoweVersions.packages, ...zoweVersions.extras })) {
    matrix.push({pkgName: k, tags: ["latest", ...Object.keys(v).filter(x => v[x])].join(" ")});
}
core.setOutput("deploy-matrix", JSON.stringify(matrix));
