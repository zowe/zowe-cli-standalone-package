const fs = require("fs");
const path = require("path");

if (process.arch === "arm64" && process.argv[2] !== "zowe-v3-lts") {
    // ARM64 support does not exist for DB2 until v3 LTS
    fs.unlinkSync(path.join(process.cwd(), "db2-for-zowe-cli.tgz"));
}
