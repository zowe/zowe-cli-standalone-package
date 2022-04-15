/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

// For snapshot builds, just use @next tag and ignore publish date
if (process.argv[3] === "next") {
    process.stdout.write(`${process.argv[2]}@${process.argv[3]}`);
    process.exit();
}

const childProcess = require("child_process");
const moment = require("moment");

const packageName = process.argv[2];
const snapshotDate = moment.utc(process.argv[3]);

const packageVersions = JSON.parse(childProcess.execSync(`npm view ${packageName} time --json`));
let latestVersion;
let latestTime = moment.utc(0);
for (const [version, time] of Object.entries(packageVersions)) {
    // We give priority to versions that:
    // (1) Include "next" in their name
    // (2) Have a publish date older than or the same as the snapshot date
    // (3) Have the newest publish date that meets the above constraints
    const versionTime = moment.utc(time);
    if (version.includes("next") && versionTime.clone().startOf("day").isSameOrBefore(snapshotDate) && versionTime.isAfter(latestTime)) {
        latestVersion = version;
        latestTime = versionTime;
    }
}

// Print @next version if one was found, otherwise fall back to @latest
process.stdout.write(`${process.argv[2]}@${latestVersion || "latest"}`);
