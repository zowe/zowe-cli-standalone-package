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

// Directories to include
const includeDirs = "src,scripts,docs,mock_project";

const processFiles = (header, findRegex, filePaths) => {
    let alreadyContainedCopyright = 0;
    for (const filePath of filePaths) {
        const file = fs.readFileSync(filePath);
        let result = file.toString();
        const resultLines = result.split(/\r?\n/g);
        if (resultLines.join().indexOf(header.split(/\r?\n/g).join()) >= 0) {
            alreadyContainedCopyright++;
            continue; // already has copyright
        }
        const shebangPattern = require("shebang-regex");
        let usedShebang = "";
        result = result.replace(shebangPattern, function (fullMatch) {
            usedShebang = fullMatch + "\n"; // save the shebang that was used, if any
            return "";
        });
        // remove any existing copyright
        // Be very, very careful messing with this regex. Regex is wonderful.
        result = result.replace(findRegex, "");
        result = header + result; // add the new header
        result = usedShebang + result; // add the shebang back
        fs.writeFileSync(filePath, result);
    }
    return alreadyContainedCopyright;
}

// process all Java/JS -ish comment-style files
require("glob")("{" + includeDirs + "}" + "{/**/*.java,/**/*.js,/**/*.ts,/**/*.gradle,/**/*.groovy}", (globErr, filePaths) => {
    if (globErr) {
        throw globErr;
    }
    
    const header = "/*\n" + fs.readFileSync("LICENSE_HEADER").toString().split(/\r?\n/g).map((line) => {
        return " " + ("* " + line).trim();
    }).join(require("os").EOL) + require("os").EOL + " */" + require("os").EOL + require("os").EOL;

    // Process all files
    const nonProcessedFiles = processFiles(header, /\/\*[\s\S]*?(Copyright|License)[\s\S]*?\*\/[\s\n]*/i, filePaths);

    console.log("JS: Ensured that %d files had copyright information (%d already did).", filePaths.length, nonProcessedFiles);
});

// process all HTML/XML -ish comment-style files
require("glob")("{" + includeDirs + "}" + "{/**/*.html,/**/*.htm,/**/*.xml}", (globErr, filePaths) => {
    if (globErr) {
        throw globErr;
    }
    
    const header = "<!--\n" + fs.readFileSync("LICENSE_HEADER").toString().split(/\r?\n/g).map((line) => {
        return "    " + (line).trim();
    }).join(require("os").EOL) + require("os").EOL + "-->" + require("os").EOL + require("os").EOL;

    // Process all files
    const nonProcessedFiles = processFiles(header, /\<\!\-\-[\s\S]*?(Copyright|License)[\s\S]*?\-\-\>[\s\n]*/i, filePaths);

    console.log("HTML: Ensured that %d files had copyright information (%d already did).", filePaths.length, nonProcessedFiles);
});