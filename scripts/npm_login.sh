#!/bin/bash
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
registry=$1
echo "//$(echo ${registry} | sed s/'http[s]\?:\/\/'//):_authToken=${NPM_TOKEN}" >> ~/.npmrc
echo "registry=${registry}" >> ~/.npmrc
npm whoami --registry=${registry}
