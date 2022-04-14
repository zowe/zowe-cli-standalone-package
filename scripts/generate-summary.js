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
const path = require("path");

const summaryLines = ["The following artifacts will be published:"];
for (const url of process.argv.slice(2)) {
    summaryLines.push(`* [${path.basename(url)}](${url})`);
}
fs.writeFileSync("summary.md", summaryLines.join("\n"));
