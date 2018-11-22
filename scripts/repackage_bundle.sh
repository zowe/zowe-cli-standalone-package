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
# mkdir -p packed/odbc_cli

for tar in "$@"
do
    mkdir temp
    tar xzf $tar -C temp
    node "configure-to-bundle.js"

    cd temp/package
    cp ../../.npmrc .
    npm install

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

    npm pack

    ls -lask
    mv ./*.tgz ../../packed
    cd ../../
    # cleanup temp directory
    rm -rf temp/
done

cd packed
if [ -f zowe-cli-bundle.zip ]; then
    rm -f zowe-cli-bundle.zip
fi
rename brightside-core zowe-cli *.tgz
rename brightside-cics zowe-cics *.tgz
rename brightside-db2 zowe-db2 *.tgz
zip -r zowe-cli-bundle.zip *
cp -f zowe-cli-bundle.zip ../zowe-cli-bundle.zip