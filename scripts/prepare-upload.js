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
const glob = require("glob");
const jsonfile = require("jsonfile");

const sourcePath = process.argv[2];
const targetPath = process.argv[3];
const uploadSpecFile = "upload-spec.json";
const artifactsFile = "artifacts.txt";
const artifactoryBaseUrl = "https://zowe.jfrog.io/artifactory/";

let uploadSpecJson = { files: [] };
if (fs.existsSync(uploadSpecFile)) {
    uploadSpecJson = jsonfile.readFileSync(uploadSpecFile);
}
uploadSpecJson.files.push({ pattern: sourcePath, target: targetPath });
jsonfile.writeFileSync(uploadSpecFile, uploadSpecJson, { spaces: 4 });

for (const filename of glob.sync(sourcePath)) {
    fs.appendFileSync(artifactsFile, `${artifactoryBaseUrl}${targetPath}${filename}\n`);
}
