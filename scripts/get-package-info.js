/*
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

const core = require("@actions/core");
const exec = require("@actions/exec");

exports.getPackageInfo = async function (pkg, opts="", prop="version") {
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
