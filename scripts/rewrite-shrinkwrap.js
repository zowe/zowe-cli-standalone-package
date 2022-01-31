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
const getPackageInfo = require(__dirname + "/get-package-info").getPackageInfo;

const _path = __dirname + "/../temp/package/npm-shrinkwrap.json";
const data = require(_path);

(async () => {
  const filterPkgs = async (obj, key) => {
    const _obj = {};
    for (const pkg of Object.keys(obj[key])) {
      if (pkg.startsWith("__tests__")) continue;
      // if (pkg === "") continue;
      // if (pkg === "node_modules/@zowe/cli") continue;
      if (obj[key][pkg].dev) continue;

      _obj[pkg] = obj[key][pkg];

      // Check if the package didn't resolve to public NPM
      if (_obj[pkg].resolved && !_obj[pkg].resolved.startsWith("https://registry.npmjs.org")) {
        const pkgPos = pkg.lastIndexOf("node_modules") + "node_modules".length + 1;

        // Check (and fail) if the package isn't a scoped package
        if(!pkg.startsWith("@") && pkg[pkgPos] !== "@") {
          console.error("Problematic pacakge:", pkg);
          throw "Problematic pacakge:" + pkg;
        }

        _obj[pkg].resolved = await getPackageInfo(pkg.substring(pkg.startsWith("@") ? 0 : pkgPos) + "@" + _obj[pkg].version, "", "dist.tarball");
        _obj[pkg].integrity = await getPackageInfo(pkg.substring(pkg.startsWith("@") ? 0 : pkgPos) + "@" + _obj[pkg].version, "", "dist.integrity");
      }
    }
    obj[key] = _obj;
  }

  await filterPkgs(data, "packages");
  await filterPkgs(data, "dependencies");

  fs.writeFileSync(_path + ".new.json", JSON.stringify(data, null, 2));
  // fs.writeFileSync(_path + ".new.json", JSON.stringify(data));
})();