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

##
# This script uses 'expect' to automate an npm login. 'Expect' must be accessible on the PATH.
#

die () {
    echo "$@"
    exit 1
}

[ "$#" -ge 3 ] || die "at least 3 arguments required. Expected args: [username,password,email,registry]. $# provided"

username=$1;
pass=$2;
email=$3;
registry=$4
export HISTIGNORE="expect*";

expect -c "
        spawn npm login $registry
        expect "?sername:"
        send \"$username\r\"
        expect "?assword:"
        send \"$pass\r\"
        expect "?mail:"
        send \"$email\r\"
        expect eof"

export HISTIGNORE="";