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

if [ $1 != "next" ]; then
  zoweVersion=v$(echo "$1" | sed 's/-RC.*//')
  imperativeVersion=v$2
  cliVersion=v$3
else
  zoweVersion=vNext
  imperativeVersion=next
  cliVersion=next
fi

mkdir -p node-sdk
cd node-sdk

# Clone Imperative and Zowe CLI repos to get the TypeScript source
git clone -b ${imperativeVersion} --depth 1 https://github.com/zowe/imperative.git
git clone -b ${cliVersion} --depth 1 https://github.com/zowe/zowe-cli.git

# Install typedoc along with dependencies and plugins
npm init -y
npm install -D --legacy-peer-deps @types/node typescript@^3.8.0 typedoc@^0.19.0 \
  @strictsoftware/typedoc-plugin-monorepo typedoc-plugin-sourcefile-url

# Transform relative URLs to absolute URLs in Imperative and CLI readmes
sed -i "s [(]\(CONTRIBUTING\|LICENSE\) (https://github.com/zowe/imperative/blob/$imperativeVersion/\1 " imperative/README.md
sed -i "s \./ https://github.com/zowe/zowe-cli/blob/$cliVersion/ " zowe-cli/README.md

# Create directory structure for Imperative and SDK packages
mkdir -p node_modules/@zowe/imperative
mv imperative/{packages,README.md} node_modules/@zowe/imperative/
mv zowe-cli/packages/core node_modules/@zowe/core-for-zowe-sdk
mv zowe-cli/packages/provisioning node_modules/@zowe/provisioning-for-zowe-sdk
mv zowe-cli/packages/zosconsole node_modules/@zowe/zos-console-for-zowe-sdk
mv zowe-cli/packages/zosfiles node_modules/@zowe/zos-files-for-zowe-sdk
mv zowe-cli/packages/zosjobs node_modules/@zowe/zos-jobs-for-zowe-sdk
mv zowe-cli/packages/zostso node_modules/@zowe/zos-tso-for-zowe-sdk
mv zowe-cli/packages/zosuss node_modules/@zowe/zos-uss-for-zowe-sdk
mv zowe-cli/packages/workflows node_modules/@zowe/zos-workflows-for-zowe-sdk
mv zowe-cli/packages/zosmf node_modules/@zowe/zosmf-for-zowe-sdk

# Generate config for typedoc sourcefile-url plugin
cat > sourcefile-map.json << EOF
[
  {
    "pattern": "^@zowe/imperative",
    "replace": "https://github.com/zowe/imperative/blob/$imperativeVersion"
  },
  {
    "pattern": "^@zowe/core-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/core"
  },
  {
    "pattern": "^@zowe/provisioning-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/provisioning"
  },
  {
    "pattern": "^@zowe/zos-console-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zosconsole"
  },
  {
    "pattern": "^@zowe/zos-files-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zosfiles"
  },
  {
    "pattern": "^@zowe/zos-jobs-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zosjobs"
  },
  {
    "pattern": "^@zowe/zos-tso-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zostso"
  },
  {
    "pattern": "^@zowe/zos-uss-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zosuss"
  },
  {
    "pattern": "^@zowe/zos-workflows-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/workflows"
  },
  {
    "pattern": "^@zowe/zosmf-for-zowe-sdk",
    "replace": "https://github.com/zowe/zowe-cli/blob/${cliVersion}/packages/zosmf"
  }
]
EOF

# Generate config for typedoc and its plugins
cat > typedoc.json << EOF
{
  "disableOutputCheck": true,
  "exclude": [
    "**/__tests__/**",
    "**/node_modules/**/node_modules",
    "**/index.ts"
  ],
  "excludeNotExported": true,
  "ignoreCompilerErrors": true,
  "name": "Zowe Node.js SDK - $zoweVersion",
  "out": "typedoc",
  "readme": "zowe-cli/README.md",
  "external-modulemap": ".*(@zowe\/[^\/]+)\/.*",
  "sourcefile-url-map": "sourcefile-map.json"
}
EOF

# Build typedoc and zip it up
npx typedoc ./node_modules/@zowe
zip -r ../zowe-node-sdk-typedoc.zip typedoc
