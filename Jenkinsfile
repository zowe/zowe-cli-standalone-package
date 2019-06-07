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
def ARTIFACTORY_CREDENTIALS_ID = 'GizaArtifactory'

/**
 * The email address for the artifactory
 */
def ARTIFACTORY_EMAIL = GIT_USER_EMAIL

/**
* The Artifactory API URL which contains builds of the Zowe CLI
*/
def GIZA_ARTIFACTORY_URL = "https://gizaartifactory.jfrog.io/gizaartifactory/api/npm/npm-local-release/"

/**
* The Zowe CLI Bundle Version to deploy to Artifactory
*/
def ZOWE_CLI_BUNDLE_VERSION = "1.3.0-SNAPSHOT"

/**
*  The Artifactory Server to deploy to.
*/ 
def ARTIFACTORY_SERVER = "gizaArtifactory"

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
def ZOWE_LICENSE_ZIP_PATH = "/org/zowe/licenses/1.0.0/zowe_licenses_full.zip"

/**
* Master branch
*/
def MASTER_BRANCH = "master"

pipeline {
    agent {
        label 'ca-jenkins-agent-mark-rev'
    }

    triggers {
        cron('0 0 * * 1-5')
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
         * DECRIPTION
         * ----------
         * Gets the latest version of the Zowe CLI and Zowe CLI Plugins from Giza
         * Artifactory. Creates an archive with 'fat' versions of the CLI and Plugins -
         *  dependencies are bundled.
         *
         * OUTPUTS
         * -------
         * A Zowe CLI Archive containing Zowe CLI, Zowe CLI DB2 Plugin, Zowe CLI CICS Plugin.
         ************************************************************************/
        stage('Create Zowe CLI Bundle') {
            when {
                allOf {
                    expression {
                        return BRANCH_NAME.equals(MASTER_BRANCH)
                    }
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    
                    sh "npm set registry https://registry.npmjs.org/"
                    sh "npm set @brightside:registry ${GIZA_ARTIFACTORY_URL}"
                    withCredentials([usernamePassword(credentialsId: ARTIFACTORY_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        // TODO: Consider using tooling like artifactory-download-spec to get license.zip. Post-Infrastructure migration answer.
                        sh "mkdir -p licenses && (cd licenses && curl -X GET -s -u$USERNAME:$PASSWORD -o zowe_licenses_full.zip https://gizaartifactory.jfrog.io/gizaartifactory/$ARTIFACTORY_RELEASE_REPO$ZOWE_LICENSE_ZIP_PATH)"
                        sh "./scripts/npm_login.sh $USERNAME $PASSWORD \"$ARTIFACTORY_EMAIL\" '--registry=${GIZA_ARTIFACTORY_URL} --scope=@brightside'"
                    }
                    sh "npm install jsonfile"

                    script {
                        sh "npm pack @brightside/db2@lts-incremental"
                        sh "npm pack @brightside/core@lts-incremental"
                        sh "npm pack @brightside/cics@lts-incremental"
                        sh "./scripts/repackage_bundle.sh *.tgz"
                        sh "mv zowe-cli-package.zip zowe-cli-package-${ZOWE_CLI_BUNDLE_VERSION}.zip"
                    }

                    archiveArtifacts artifacts: "zowe-cli-package-${ZOWE_CLI_BUNDLE_VERSION}.zip"
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
        * DECRIPTION
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
                        return BRANCH_NAME.equals(MASTER_BRANCH)
                    }
                }
            }
            steps {
                timeout(time: 5, unit: 'MINUTES' ) {
                    script {
                        def server = Artifactory.server ARTIFACTORY_SERVER
                        def targetVersion = ZOWE_CLI_BUNDLE_VERSION
                        def targetRepository = targetVersion.contains("-SNAPSHOT") ? ARTIFACTORY_SNAPSHOT_REPO : ARTIFACTORY_RELEASE_REPO
                        def uploadSpec = """{
                        "files": [{
                            "pattern": "zowe-cli-package-*.zip",
                            "target": "${targetRepository}/org/zowe/cli/zowe-cli-package/${targetVersion}/"
                        }]
                        }"""
                        def buildInfo = Artifactory.newBuildInfo()
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