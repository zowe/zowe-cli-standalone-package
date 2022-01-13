const fs = require("fs");
const glob = require("glob");
const jsonfile = require("jsonfile");

const sourcePath = process.argv[2];
const targetPath = process.argv[3];
const uploadSpecFile = "upload-spec.json";
const summaryFile = "summary.md";
const artifactoryBaseUrl = "https://zowe.jfrog.io/artifactory/";

let uploadSpecJson = { files: [] };
if (fs.existsSync(uploadSpecFile)) {
    uploadSpecJson = jsonfile.readFileSync(uploadSpecFile);
}
uploadSpecJson.files.push({ pattern: sourcePath, target: targetPath });
jsonfile.writeFileSync(uploadSpecFile, uploadSpecJson, { spaces: 4 });

if (!fs.existsSync(summaryFile)) {
    fs.writeFileSync(summaryFile, "The following artifacts will be published:\n");
}
for (const filename of glob.sync(sourcePath)) {
    fs.appendFileSync(summaryFile, `* [${filename}](${artifactoryBaseUrl}${targetPath}${filename})\n`);
}
