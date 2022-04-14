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
const flat = require("flat");
const jsYaml = require("js-yaml");

const utils = require(__dirname + "/utils");

const packageTag = process.argv[2];
const releaseType = process.argv[3];

const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
core.exportVariable("SHORT_VERSION", packageTag !== "next" ? zoweVersions.tags[packageTag].version : "next");

if (releaseType === "release") {
    if (packageTag !== "next") {
        core.exportVariable("VERSION", zoweVersions.tags[packageTag].version + "-RC" + zoweVersions.tags[packageTag].rc);
    } else {
        const nextSnapshotDate = zoweVersions.tags.next.snapshot.replace(/-/g, "");
        core.exportVariable("VERSION", "next-" + nextSnapshotDate);
    }
} else if (releaseType === "snapshot") {
    if (packageTag !== "next") {
        core.exportVariable("VERSION", zoweVersions.tags[packageTag].version + "-SNAPSHOT");
    } else {
        const nextSnapshotDate = new Date.toISOString().slice(0, 10).replace(/-/g, "");
        core.exportVariable("VERSION", "next-" + nextSnapshotDate + "-SNAPSHOT");
    }
} else {
    throw new Error("Unknown release type: " + releaseType);
}

for (const [k, v] of Object.entries(flat(zoweVersions, { delimiter: "_" }))) {
    if (k.includes(packageTag)) {
        if (k.startsWith("packages")) {
            if (releaseType === "snapshot") {
                v = packageTag;
            } else if (packageTag === "next") {
                v = utils.getNextVersion("@zowe/" + k.split("_")[1], zoweVersions.tags.next.snapshot);
            }
        }
        core.setOutput(k.replace(`_${packageTag}`, ""), v);
    }
}
