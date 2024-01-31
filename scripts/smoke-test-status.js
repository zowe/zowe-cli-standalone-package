const core = require("@actions/core");
const fs = require("fs");
const glob = require("glob");

(async () => {
    const hostFiles = glob.sync("status-*.json");
    const object = [];
    const list = [];
    for (const globFile of hostFiles) {
        object.push(JSON.parse(fs.readFileSync(globFile).toString()));
    }

    for (const entry of object){ 
        list.push([entry.arch, entry.platform, entry.package, entry.tag, entry.success ? "Succeeded" : "Failed"]);
    }

    await core.summary.addHeading('Smoke Test Results').addTable([
        {data: "CPU Arch", header: true},
        {data: "Platform", header: true},
        {data: "Package", header: true},
        {data: "Tag", header: true},
        {data: "Status", header: true}
    ], ...list).write();
})();
