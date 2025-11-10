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
const getPackageInfo = require(__dirname + "/utils").getPackageInfo;

const _path = __dirname + "/../temp/package/npm-shrinkwrap.json";
const data = require(_path);

(async () => {
  const filterPkgs = async (obj, key) => {
    const _obj = {};
    for (const pkg of Object.keys(obj[key] || {})) {
      if (obj[key][pkg].dev) continue;
      if (obj[key][pkg].peer) continue;
      if (obj[key][pkg].extraneous) continue;

      _obj[pkg] = obj[key][pkg];

      // If the package is @zowe-scoped, replace Artifactory SHA with public NPM one
      if (pkg.startsWith("@zowe/")) {
        console.log(`Updating integrity field for ${pkg}`);
        console.log("before", _obj[pkg].integrity);
        _obj[pkg].integrity = await getPackageInfo(pkg + "@" + _obj[pkg].version, "", "dist.integrity");
        console.log("after", _obj[pkg].integrity);
      }
    }
    obj[key] = _obj;
  }

  await filterPkgs(data, "packages");
  await filterPkgs(data, "dependencies");

  fs.writeFileSync(_path, JSON.stringify(data, null, 2) + "\n" );
})();