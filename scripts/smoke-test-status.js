const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

(async () => {
    const hostFiles = glob.sync("status-*/status-*.json");
    const object = [];
    const list = [];
    const successObj = {};
    for (const globFile of hostFiles) {
        object.push(...JSON.parse(fs.readFileSync(globFile).toString()));
    }
    object.sort((a, b) => a.compare.localeCompare(b.compare));

    for (const entry of object){
        if (entry.arch == "arm64" && entry.package == "db2-for-zowe-cli") {
            list.push([entry.package, entry.tag, entry.platform, entry.arch, "Not Supported 😢"]);
        } else {
            list.push([entry.package, entry.tag, entry.platform, entry.arch, entry.success ? "Succeeded ✅" : "Failed ❌"]);
            if (successObj[entry.package] == undefined) { successObj[entry.package] = {};}
            if (successObj[entry.package][entry.tag] == undefined || successObj[entry.package][entry.tag] != false) {
                successObj[entry.package][entry.tag] = entry.success;
            }
        }
    }

    fs.writeFileSync(path.join(process.cwd(), "publish-list.json"), JSON.stringify(successObj, null, 4));

    await core.summary.addHeading('Smoke Test Results').addTable([
    [
        {data: "Package", header: true},
        {data: "Tag", header: true},
        {data: "Platform", header: true},
        {data: "CPU Arch", header: true},
        {data: "Status", header: true}
    ],
    ...list]).write();
})();
