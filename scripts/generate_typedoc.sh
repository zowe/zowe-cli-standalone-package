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
set -e

# Define Zowe bundle version and Git branches/tags for Imperative/CLI
# $zoweVersion is used in the typedoc page header
# $imperativeBranch is used to build Imperative doc and link to its Git repo
# $cliBranch is used to build Zowe SDK doc and link to their Git repo
if [[ $1 != "next"* ]]; then
  zoweVersion=v$(echo "$1" | sed 's/-RC.*//')
  if [[ $zoweVersion != *"SNAPSHOT" ]]; then
    imperativeBranch=v$2
    cliBranch=v$3
  else
    imperativeBranch=$(echo "$2" | sed 's/zowe-v2-lts/master/')
    cliBranch=$(echo "$3" | sed 's/zowe-v2-lts/master/')
  fi
else
  zoweVersion=vNext
  imperativeBranch=next
  cliBranch=next
fi

mkdir -p node-sdk
cd node-sdk

# Clone Imperative and Zowe CLI repos to get the TypeScript source
git clone -b ${imperativeBranch} --depth 1 https://github.com/zowe/imperative.git
git clone -b ${cliBranch} --depth 1 https://github.com/zowe/zowe-cli.git

# Install typedoc along with dependencies and plugins
npm init -y
npm install -D --legacy-peer-deps @types/node typescript@^3.8.0 typedoc@^0.19.0 \
  @strictsoftware/typedoc-plugin-monorepo typedoc-plugin-sourcefile-url

# Transform relative URLs to absolute URLs in Imperative and CLI readmes
sed -i "s [(]\(CONTRIBUTING\|LICENSE\) (https://github.com/zowe/imperative/blob/$imperativeBranch/\1 " imperative/README.md
sed -i "s \./ https://github.com/zowe/zowe-cli/blob/$cliBranch/ " zowe-cli/README.md

# Create directory structure for Imperative and SDK packages
# Also generate config for typedoc sourcefile-url plugin
mkdir -p node_modules/@zowe/imperative
mv imperative/{packages,README.md} node_modules/@zowe/imperative/
cat > sourcefile-map.json << EOF
[
  {
    "pattern": "^@zowe/imperative",
    "replace": "https://github.com/zowe/imperative/blob/$imperativeBranch"
  }
]
EOF

for pkgDir in zowe-cli/packages/*; do
  if [[ $pkgDir != *"cli" ]]; then
    pkgName=$(node -p "require('jsonfile').readFileSync('$pkgDir/package.json').name")
    mv $pkgDir node_modules/$pkgName
    cat <<< $(jq ". + [{\"pattern\": \"^$pkgName\", \"replace\": \"https://github.com/zowe/zowe-cli/blob/${cliBranch}/packages/$(basename $pkgDir)\"}]" sourcefile-map.json) > sourcefile-map.json
  fi
done

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
