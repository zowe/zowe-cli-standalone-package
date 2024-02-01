const fs = require("fs");
const path = require("path");

if (process.arch === "arm64") {
    // ARM64 support does not exist for DB2
    fs.unlinkSync(path.join(process.cwd(), "db2-for-zowe-cli.tgz"));
}
