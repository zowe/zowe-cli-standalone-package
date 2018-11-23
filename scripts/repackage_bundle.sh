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

mkdir -p packed

# Loop through each tar (representing an `npm pack`), and create new tars with packed dependencies.
for tar in "$@"
do
    mkdir temp
    tar xzf $tar -C temp

    # Changes the package.json format
    node "configure-to-bundle.js"


    cd temp/package
    cp ../../.npmrc .
    npm install

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

    # Pack the NPM Archive
    npm pack

    ls -lask
    mv ./*.tgz ../../packed
    cd ../../
    # cleanup temp directory
    rm -rf temp/
done

cd packed
zip -r zowe-cli-bundle.zip *
cp -f zowe-cli-bundle.zip ../zowe-cli-bundle.zip