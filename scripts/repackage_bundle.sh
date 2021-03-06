#!/usr/bin/env bash
###
# This program and the accompanying materials are made available under the terms of the
# Eclipse Public License v2.0 which accompanies this distribution, and is available at
# https://www.eclipse.org/legal/epl-v20.html
#
# SPDX-License-Identifier: EPL-2.0
#
# Copyright Contributors to the Zowe Project.
#
###
set -ex

mkdir -p packed

# Loop through each tar (representing an `npm pack`), and create new tars with packed dependencies.
for tar in "$@"
do
    mkdir temp
    tar xzf $tar -C temp

    # Changes the package.json format
    node "$(dirname $0)/configure-to-bundle.js"

    cd temp/package
    cp ../../.npmrc . || true

    ## Extra work required to delete imperative prepare script
    ## This prevents Husky from erroring out - and it isn't needed if we aren't developing Imperative
    if [[ $tar = *"imperative"* ]]; then
        node -e "package = require('./package.json');
                 delete package.scripts.prepare;
                 require('fs').writeFileSync('package.json', JSON.stringify(package, null, 2), 'utf8')"
    fi

    npm install --legacy-peer-deps --ignore-scripts

    # Extra work required for the db2 plugin with respect to packing the ibm_db plugin
    # The plugin does not support reinstall, and deletes required files during a normal install.
    # This block restores the plugin structure to a 'clean' state
    if [[ $tar = *"db2"* ]]; then
        ibm_db_ver=`node -e "package = require('./package.json');console.log(package.dependencies['ibm_db'])"`
        npm pack "ibm_db@$ibm_db_ver"
        tar -xzf ibm_db*.tgz
        cp "./package/build.zip" "./node_modules/ibm_db"
        rm -rf "./package"
        rm -r ibm_db*.tgz
        rm -rf "./node_modules/ibm_db/build"
        rm -rf "./node_modules/ibm_db/installer/clidriver"
    fi

    # Extra work required for the SCS plugin (LTS) or CLI (Next) to support offline install.
    # We include prebuilt native code bundles for Keytar and clean up unwanted binaries.
    if [[ $tar = *"secure-credential-store"* || $tar = "zowe-cli-7"* ]]; then
        mkdir -p "./node_modules/keytar/prebuilds"
        keytar_ver=`node -e "package = require('./package.json');console.log(package.dependencies['keytar'] || package.optionalDependencies['keytar'])"`
        curl -fOJ https://zowe.jfrog.io/artifactory/libs-snapshot-local/org/zowe/cli/zowe-cli-prebuilds/keytar-${keytar_ver}-prebuilds.tgz
        tar -xzf keytar-*-prebuilds.tgz --directory "./node_modules/keytar/prebuilds"
        rm -r keytar-*-prebuilds.tgz
        rm -rf "./node_modules/keytar/build"
    fi

    # Pack the NPM Archive
    npm pack

    # Remove the version number from the tar file
    simpler_name=`node -e "console.log(\"$tar\".split('.')[0].slice(0,-2) + \".tgz\")"`
    # Remove scope only for plugins
    simpler_name=`node -e "console.log(\"$simpler_name\" === 'zowe-cli.tgz' ? \"$simpler_name\" : \"$simpler_name\".replace('zowe-',''))"`
    mv $tar $simpler_name

    ls -lask
    mv ./*.tgz ../../packed
    cd ../../
    # cleanup temp directory
    rm -rf temp/
done
# Copy licenses dir, downloaded from Jenkins file - to packed area for zip.
cp -a licenses packed
cd packed
# No longer needed?
# rename 's/brightside\-core*/zowe\-cli/' *
# rename 's/brightside\-cics*/zowe\-cics/' *
# rename 's/brightside\-db2*/zowe\-db2/' *
zip -r zowe-cli-package.zip *
mv zowe-cli-package.zip ../zowe-cli-package.zip
rm -rf *.tgz