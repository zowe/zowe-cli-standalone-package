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
const jsYaml = require("js-yaml");
const moment = require("moment");
const fetch = require("node-fetch");
const core = require("@actions/core");
const exec = require("@actions/exec");

async function getPackageInfo(pkg, opts="", prop="version") {
    core.info(`Getting '${prop}' for package: ${pkg}`);
    const viewArgs = ["view", pkg, prop];
    if (opts) {
        viewArgs.push(opts);
    }
    let cmdOutput;
    try {
        cmdOutput = (await exec.getExecOutput("npm", viewArgs)).stdout.trim();
    } catch {
        throw new Error(`Package not found: ${pkg}`);
    }
    if (cmdOutput.length === 0) {
        throw new Error(`Property not found: ${prop}`);
    }
    return cmdOutput;
}

async function shouldSkipPublish(pkgName, pkgTag, pkgVersion) {
    const response = await fetch("https://raw.githubusercontent.com/zowe/zowe.github.io/master/_data/releases.yml", {
        headers: (process.env.CI && !process.env.ACT) ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}
    });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const releasesData = jsYaml.load(await response.text());

    const zoweVersions = jsYaml.load(fs.readFileSync(__dirname + "/../zowe-versions.yaml", "utf-8"));
    const isStaging = zoweVersions.tags["zowe-v1-lts"].version > releasesData[0].version;
    if (!isStaging || zoweVersions.packages[pkgName] == null) {
        return false;
    }

    if (pkgTag === "latest") {
        // For latest tag, we assume it is aliased with the first tag defined for the package
        pkgTag = Object.keys(zoweVersions.packages[pkgName])[0];
    }

    if (pkgTag !== "next") {
        return pkgVersion > zoweVersions.packages[pkgName]["zowe-v1-lts"];
    } else {
        const dateString = pkgVersion.split(".").pop();
        const pkgDate = moment(`${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`);
        return pkgDate.isAfter(moment(zoweVersions.tags.next.snapshot));
    }
}

exports.getPackageInfo = getPackageInfo;
exports.shouldSkipPublish = shouldSkipPublish;
