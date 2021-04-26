/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

/**
 * List of people who will get all emails for master builds
 */
def MASTER_RECIPIENTS_LIST = "cc:Mark.Ackert@broadcom.com"

/**
 * The user's name for git commits
 */
def GIT_USER_NAME = 'zowe-robot'

/**
 * The user's email address for git commits
 */
def GIT_USER_EMAIL = 'zowe.robot@gmail.com'

/**
 * The base repository url for github
 */
def GIT_REPO_URL = 'github.com/zowe/zowe-cli-standalone-package.git'

/**
 * The credentials id field for the authorization token for GitHub stored in Jenkins
 */
def GIT_CREDENTIALS_ID = 'zowe-robot-github'

/**
 * A command to be run that gets the current revision pulled down
 */
def GIT_REVISION_LOOKUP = 'git log -n 1 --pretty=format:%h'

/**
 * The credentials id field for the artifactory username and password
 */
def ARTIFACTORY_CREDENTIALS_ID = 'zowe.jfrog.io'

/**
 * The email address for the artifactory
 */
def ARTIFACTORY_EMAIL = GIT_USER_EMAIL

/**
* The Artifactory API URL which contains builds of the Zowe CLI
*/
def ZOWE_ARTIFACTORY_URL = "https://zowe.jfrog.io/zowe/api/npm/npm-local-release/"

/**
* The Zowe CLI Bundle Version to deploy to Artifactory
*/
def ZOWE_CLI_BUNDLE_VERSION = "next"
def ZOWE_VERSION_NUMBER = "1.21.0"

/**
*  The Artifactory Server to deploy to.
*/
def ARTIFACTORY_SERVER = "zoweArtifactory"

/**
* The target repository for Zowe CLI Package SNAPSHOTs
*/
def ARTIFACTORY_SNAPSHOT_REPO = "libs-snapshot-local"

/**
* Target Repository for Zowe CLI Package Releases
*/
def ARTIFACTORY_RELEASE_REPO = "libs-release-local"

/**
* Zowe 1.0.0 licenses
*/
def ZOWE_LICENSE_ZIP_PATH = "/org/zowe/licenses/1.20.0/zowe_licenses_full.zip"

/**
* The locations where the pipeline will look for the License Zip
*/
def ZOWE_LICENSE_ZIP_URL = "https://zowe.jfrog.io/zowe/$ARTIFACTORY_RELEASE_REPO$ZOWE_LICENSE_ZIP_PATH"
// def ZOWE_LICENSE_ZIP_URL = "https://wash.zowe.org:8443/job/Zowe%20Dependency%20Scan%20-%20Multibranch/job/staging%252Fv$ZOWE_VERSION_NUMBER/lastSuccessfulBuild/artifact/zowe_licenses_full.zip"

/**
* Next branch
*/
def NEXT_BRANCH = "next"

/**
* Variables defined later in pipeline
*/
def imperativeVersion
def zoweCliVersion

pipeline {
    agent {
        label 'ca-jenkins-agent-mark-rev'
    }

    triggers {
        cron('0 0 * * *')
    }

    stages {
        /************************************************************************
         * STAGE
         * -----
         * Build Zowe CLI Bundle
         *
         * TIMEOUT
         * -------
         * 10 Minutes
         *
         * EXECUTION CONDITIONS
         * --------------------
         * - Always
         *
         * DESCRIPTION
         * ----------
         * Gets the latest version of the Zowe CLI and SCS plugin from Zowe
         * Artifactory. Creates an archive with 'fat' versions of the CLI and Plugin -
         *  dependencies are bundled.
         *
         * OUTPUTS
         * -------
         * A Zowe CLI Archive containing Zowe CLI and Zowe CLI Secure Credential Store Plugin
         ************************************************************************/
        stage('Create Zowe CLI Bundle') {
            when {
                allOf {
                    expression {
                        return BRANCH_NAME.equals(NEXT_BRANCH)
                    }
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {

                    sh "npm set registry https://registry.npmjs.org/"
                    sh "npm set @zowe:registry ${ZOWE_ARTIFACTORY_URL}"
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        // TODO: Consider using tooling like artifactory-download-spec to get license.zip. Post-Infrastructure migration answer.
                        sh "mkdir -p licenses && cd licenses && curl -fs -o zowe_licenses_full.zip $ZOWE_LICENSE_ZIP_URL"
                        sh "./scripts/npm_login.sh $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" '--registry=${ZOWE_ARTIFACTORY_URL} --scope=@zowe'"
                    }
                    sh "npm install jsonfile"

                    script { zoweCliVersion = "next" }
                    sh "npm pack @zowe/cli@${zoweCliVersion}"
                    // SCS plug-in deprecated in @next
                    // sh "npm pack @zowe/secure-credential-store-for-zowe-cli@4.1.3"
                    sh "./scripts/repackage_bundle.sh *.tgz"
                    sh "mv zowe-cli-package.zip zowe-cli-package-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    archiveArtifacts artifacts: "zowe-cli-package-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    // Remove all tgzs after bundle is archived
                    sh "rm -f *.tgz"
                }
            }
        }
        /************************************************************************
         * STAGE
         * -----
         * Build Zowe CLI Plugins Bundle
         *
         * TIMEOUT
         * -------
         * 10 Minutes
         *
         * EXECUTION CONDITIONS
         * --------------------
         * - Always
         *
         * DESCRIPTION
         * ----------
         * Gets the latest version of the Zowe CLI Plugins from Zowe
         * Artifactory. Creates an archive with 'fat' versions of the Plugins -
         *  dependencies are bundled.
         *
         * OUTPUTS
         * -------
         * A Zowe CLI Plugins Archive containing Zowe CLI DB2 Plugin, Zowe CLI CICS Plugin,
         * Zowe CLI z/OS FTP Plugin, Zowe CLI IMS Plugin, and Zowe CLI MQ Plugin.
         ************************************************************************/
        stage('Create Zowe CLI Plugins Bundle') {
            when {
                allOf {
                    expression {
                        return BRANCH_NAME.equals(NEXT_BRANCH)
                    }
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {

                    sh "npm set registry https://registry.npmjs.org/"
                    sh "npm set @zowe:registry ${ZOWE_ARTIFACTORY_URL}"
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        // TODO: Consider using tooling like artifactory-download-spec to get license.zip. Post-Infrastructure migration answer.
                        sh "mkdir -p licenses && cd licenses && curl -fs -o zowe_licenses_full.zip $ZOWE_LICENSE_ZIP_URL"
                        sh "./scripts/npm_login.sh $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" '--registry=${ZOWE_ARTIFACTORY_URL} --scope=@zowe'"
                    }
                    sh "npm install jsonfile"

                    sh "npm pack @zowe/db2-for-zowe-cli@next"
                    sh "npm pack @zowe/cics-for-zowe-cli@next"
                    sh "npm pack @zowe/ims-for-zowe-cli@next"
                    sh "npm pack @zowe/mq-for-zowe-cli@next"
                    // FTP plug-in doesn't have @next version yet
                    // sh "npm pack @zowe/zos-ftp-for-zowe-cli@1.4.1"
                    sh "./scripts/repackage_bundle.sh *.tgz"
                    sh "mv zowe-cli-package.zip zowe-cli-plugins-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    archiveArtifacts artifacts: "zowe-cli-plugins-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    // Remove all tgzs after bundle is archived
                    sh "rm -f *.tgz"
                }
            }
        }
        /************************************************************************
         * STAGE
         * -----
         * Build Zowe NodeJS SDK Bundle
         *
         * TIMEOUT
         * -------
         * 10 Minutes
         *
         * EXECUTION CONDITIONS
         * --------------------
         * - Always
         *
         * DESCRIPTION
         * ----------
         * Gets the latest version of the Zowe NodeJS SDK package from NPM
         * Creates an archive with 'fat' versions of the Plugins -
         *   dependencies are bundled.
         *
         * OUTPUTS
         * -------
         * A Zowe NodeJS SDK Archive.
         ************************************************************************/
        stage('Create Zowe NodeJS SDK Bundle') {
            when {
                allOf {
                    expression {
                        return BRANCH_NAME.equals(NEXT_BRANCH)
                    }
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {

                    sh "npm set registry https://registry.npmjs.org/"
                    sh "npm set @zowe:registry ${ZOWE_ARTIFACTORY_URL}"
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        // TODO: Consider using tooling like artifactory-download-spec to get license.zip. Post-Infrastructure migration answer.
                        sh "mkdir -p licenses && cd licenses && curl -fs -o zowe_licenses_full.zip $ZOWE_LICENSE_ZIP_URL"
                        sh "./scripts/npm_login.sh $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" '--registry=${ZOWE_ARTIFACTORY_URL} --scope=@zowe'"
                    }
                    sh "npm install jsonfile"

                    script { imperativeVersion = "next" }
                    sh "npm pack @zowe/imperative@${imperativeVersion}"
                    sh "npm pack @zowe/core-for-zowe-sdk@next"
                    sh "npm pack @zowe/provisioning-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-console-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-files-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-jobs-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-tso-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-uss-for-zowe-sdk@next"
                    sh "npm pack @zowe/zos-workflows-for-zowe-sdk@next"
                    sh "npm pack @zowe/zosmf-for-zowe-sdk@next"

                    sh "./scripts/repackage_bundle.sh *.tgz" // Outputs a zowe-cli-package.zip
                    sh "mv zowe-cli-package.zip zowe-nodejs-sdk-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    sh "./scripts/generate_typedoc.sh ${ZOWE_CLI_BUNDLE_VERSION} ${imperativeVersion} ${zoweCliVersion}" // Outputs a zowe-node-sdk-typedoc.zip
                    sh "mv zowe-node-sdk-typedoc.zip zowe-nodejs-sdk-typedoc-${ZOWE_CLI_BUNDLE_VERSION}.zip"

                    archiveArtifacts artifacts: "zowe-nodejs-sdk*-${ZOWE_CLI_BUNDLE_VERSION}.zip"
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: "node-sdk/typedoc",
                        reportFiles: "index.html",
                        reportName: "zowe-nodejs-sdk-typedoc",
                        reportTitles: "Typedoc"
                    ])

                    // Remove all tgzs after bundle is archived
                    sh "rm -f *.tgz"
                }
            }
        }
        /************************************************************************
         * STAGE
         * -----
         * Build Zowe Python SDK Bundle
         *
         * TIMEOUT
         * -------
         * 10 Minutes
         *
         * EXECUTION CONDITIONS
         * --------------------
         * - Always
         *
         * DESCRIPTION
         * ----------
         * Gets the latest version of the Zowe Python SDK package from pypi.org
         *
         * OUTPUTS
         * -------
         * A Zowe Python SDK Archive.
         ************************************************************************/
        stage('Create Zowe Python SDK Bundle') {
            when {
                allOf {
                    expression {
                        return false  // Python SDK doesn't have @next version yet
                    }
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    // Download all zowe wheels into a temp folder
                    sh "mkdir -p temp && cd temp && pip3 download zowe"
                    sh "cd temp && mkdir -p licenses && cd licenses && curl -fs -o zowe_licenses_full.zip $ZOWE_LICENSE_ZIP_URL"

                    // Zip all zowe wheels into a zowe-sdk.zip
                    sh "cd temp && zip -r zowe-sdk.zip * && mv zowe-sdk.zip ../ && rm -rf temp"

                    // Archive the zowe Python SDK
                    sh "mv zowe-sdk.zip zowe-python-sdk-${ZOWE_CLI_BUNDLE_VERSION}.zip"
                    archiveArtifacts artifacts: "zowe-python-sdk-${ZOWE_CLI_BUNDLE_VERSION}.zip"
                }
            }
        }
        /************************************************************************
        * STAGE
        * -----
        * Publish Zowe Bundle
        *
        * TIMEOUT
        * -------
        * 5 Minutes
        *
        * EXECUTION CONDITIONS
        * --------------------
        * - Always
        *
        * DESCRIPTION
        * ----------
        * Take the bundled zip from prior step, and upload it to Artifactory.
        * Working versions will be deployed as SNAPSHOTS, and release versions as semantic
        * versions matching planned convenience releases of the Zowe project.
        *
        * OUTPUTS
        * -------
        * A Zowe CLI Archive is published to Artifactory
        ************************************************************************/
        stage('Publish Bundle to Artifactory') {
            when {
                allOf {
                    expression {
                        return false  // Don't publish anything for @next release
                    }
                }
            }
            steps {
                timeout(time: 5, unit: 'MINUTES' ) {
                    script {
                        def server = Artifactory.server ARTIFACTORY_SERVER
                        def targetVersion = ZOWE_CLI_BUNDLE_VERSION
                        def targetRepository = targetVersion.contains("-SNAPSHOT") ? ARTIFACTORY_SNAPSHOT_REPO : ARTIFACTORY_RELEASE_REPO

                        // Upload Core CLI and SCS (zowe-cli-package)
                        def uploadSpec = """{
                        "files": [{
                            "pattern": "zowe-cli-package-*.zip",
                            "target": "${targetRepository}/org/zowe/cli/zowe-cli-package/${targetVersion}/"
                        }]
                        }"""
                        def buildInfo = Artifactory.newBuildInfo()
                        server.upload spec: uploadSpec, buildInfo: buildInfo
                        server.publishBuildInfo buildInfo

                        // Upload all other plugins (zowe-cli-plugins)
                        uploadSpec = """{
                        "files": [{
                            "pattern": "zowe-cli-plugins-*.zip",
                            "target": "${targetRepository}/org/zowe/cli/zowe-cli-plugins/${targetVersion}/"
                        }]
                        }"""
                        buildInfo = Artifactory.newBuildInfo()
                        server.upload spec: uploadSpec, buildInfo: buildInfo
                        server.publishBuildInfo buildInfo

                        // Upload NodeJS SDK packages (zowe-nodejs-sdk)
                        uploadSpec = """{
                        "files": [{
                            "pattern": "zowe-nodejs-sdk-*.zip",
                            "target": "${targetRepository}/org/zowe/sdk/zowe-nodejs-sdk/${targetVersion}/"
                        }]
                        }"""
                        buildInfo = Artifactory.newBuildInfo()
                        server.upload spec: uploadSpec, buildInfo: buildInfo
                        server.publishBuildInfo buildInfo

                        // Upload Python SDK packages (zowe-python-sdk)
                        uploadSpec = """{
                        "files": [{
                            "pattern": "zowe-python-sdk-*.zip",
                            "target": "${targetRepository}/org/zowe/sdk/zowe-python-sdk/${targetVersion}/"
                        }]
                        }"""
                        buildInfo = Artifactory.newBuildInfo()
                        server.upload spec: uploadSpec, buildInfo: buildInfo
                        server.publishBuildInfo buildInfo
                    }
                }
            }
        }
    }
    post {
        /************************************************************************
         * POST BUILD ACTION
         *
         * Sends out emails for the deployment status
         *
         * If the build fails, the build number and a link to the build will be present for further investigation.
         *
         * The build workspace is deleted after the build completes.
         ************************************************************************/
        always {
            script {
                def buildStatus = currentBuild.currentResult
                try {
                    def recipients = "${MASTER_RECIPIENTS_LIST}"

                    def subject = "${currentBuild.currentResult}: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'"
                    def consoleOutput = """
                    <p>Branch: <b>${BRANCH_NAME}</b></p>
                    <p>Check console output at "<a href="${RUN_DISPLAY_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>
                    """

                    if (details != "") {
                        echo "Sending out email with details"
                        emailext(
                                subject: subject,
                                to: recipients,
                                body: "${consoleOutput}",
                                recipientProviders: [[$class: 'DevelopersRecipientProvider'],
                                                        [$class: 'UpstreamComitterRecipientProvider'],
                                                        [$class: 'CulpritsRecipientProvider'],
                                                        [$class: 'RequesterRecipientProvider']]
                        )
                    }
                } catch (e) {
                    echo "Experienced an error sending an email for a ${buildStatus} build"
                    currentBuild.result = buildStatus
                }
            }
        }
    }
}