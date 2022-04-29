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
const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));

const packageTag = process.argv[2];
const releaseType = process.argv[3];

// For branches named "vX.Y.Z/master", do not allow publishing LTS versions other than zowe-vX-lts
if (packageTag !== "next" && /^v\d/.test(process.env.GIT_BRANCH) &&
    !packageTag.includes(process.env.GIT_BRANCH.slice(0, 2))) {
    throw new Error(`Bundling ${packageTag} is not allowed in the ${process.env.GIT_BRANCH} branch`);
}

// Short version equals semver for Zowe LTS releases or "next" for vNext
let bundleVersionShort = packageTag;
if (packageTag !== "next") {
    bundleVersionShort = zoweVersions.tags[packageTag].version + (releaseType === "snapshot" ? "-SNAPSHOT" : "");
}
core.exportVariable("BUNDLE_VERSION_SHORT", bundleVersionShort);

if (releaseType === "release") {
    if (packageTag !== "next") {
        // For LTS releases, bundle version is "X.Y.Z-RCn"
        core.exportVariable("BUNDLE_VERSION", zoweVersions.tags[packageTag].version + "-RC" + zoweVersions.tags[packageTag].rc);
    } else {
        // For vNext releases, bundle version is "next-YYYYMMDD"
        const nextSnapshotDate = zoweVersions.tags.next.snapshot.replace(/-/g, "");
        core.exportVariable("BUNDLE_VERSION", "next-" + nextSnapshotDate);
    }
} else if (releaseType === "snapshot") {
    if (packageTag !== "next") {
        // For vNext releases, bundle version is "X.Y.Z-SNAPSHOT"
        core.exportVariable("BUNDLE_VERSION", zoweVersions.tags[packageTag].version + "-SNAPSHOT");
    } else {
        // For vNext snapshots, bundle version is "next-YYYYMMDD" (today's date)
        const nextSnapshotDate = new Date.toISOString().slice(0, 10).replace(/-/g, "");
        core.exportVariable("BUNDLE_VERSION", "next-" + nextSnapshotDate + "-SNAPSHOT");
    }
} else {
    throw new Error("Unknown release type: " + releaseType);
}

for (let [k, v] of Object.entries(flat(zoweVersions, { delimiter: "_" }))) {
    if (k.includes(packageTag)) {
        if (k.startsWith("packages")) {
            if (releaseType === "snapshot") {
                // For snapshots, use tag like zowe-v1-lts instead of specific versions
                v = packageTag;
            } else if (packageTag === "next") {
                // For vNext releases, find latest version that matches snapshot date
                v = utils.getNextVersion("@zowe/" + k.split("_")[1], zoweVersions.tags.next.snapshot);
            }
        }
        // Remove package tag from name to make it shorter (e.g., `packages_cli_zowe-v1-lts` -> `packages_cli`)
        core.setOutput(k.replace(`_${packageTag}`, ""), v);
    }
}
