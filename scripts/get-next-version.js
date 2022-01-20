// For snapshot builds, just use @next tag and ignore publish date
if (process.argv[3] === "next") {
    process.stdout.write(`${process.argv[2]}@${process.argv[3]}`);
    process.exit();
}

const childProcess = require("child_process");
const moment = require("moment");

const packageName = process.argv[2];
const snapshotDate = moment(process.argv[3]);

const packageVersions = JSON.parse(childProcess.execSync(`npm view ${packageName} time --json`));
let latestVersion;
let latestTime = moment(0);
for (const [version, time] of Object.entries(packageVersions)) {
    // We give priority to versions that:
    // (1) Include "next" in their name
    // (2) Have a publish date older than or the same as the snapshot date
    // (3) Have the newest publish date that meets the above constraints
    const versionTime = moment(time);
    if (version.includes("next") && versionTime.startOf("day").isSameOrBefore(snapshotDate) && versionTime.isAfter(latestTime)) {
        latestVersion = version;
        latestTime = versionTime;
    }
}

// Print @next version if one was found, otherwise fall back to @latest
process.stdout.write(`${process.argv[2]}@${latestVersion || "latest"}`);
