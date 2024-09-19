# Zowe CLI Standalone Package Pipeline

This repository pulls the latest Zowe CLI and Zowe CLI Plugin Artifacts from Artifactory, and generates a standalone ZIP file containing the contents.

The standalone ZIP is intended to be offline-installable for those users who are unable to connect to public NPM registries. The Zowe CLI DB2 Plugin is the lone exception, as this plugin has dependencies on ODBC drivers and DDB licenses which much be obtained by users separately. See the official Zowe Documentation for more information.

## Steps prior to a Zowe Release

Before every Zowe release goes GA, we need to align with the code freeze dates and produce snapshots to be promoted to RCs later in the process. Follow the steps below to accomplish that.

1. Create a PR into `master` with the following changes and information:
    - Update release number to match the RC that's going out (e.g. 1.22.0)
    - Update any packages that changed after the last Zowe Release.
    - Add a summary of the changes in the PR description like below:
      | Updated Packages | Old Version | New Version |
      | --- | --- | --- |
      | Imperative | 4.13.0 | 4.13.1 |
      | Zowe CLI and SDKs | 6.31.0 | 6.31.1 |
      | z/OS USS SDK for Zowe CLI | 6.30.0 | 6.31.1 |
      | SCS plug-in for Zowe CLI | 4.1.3 | 4.1.5 |
      | z/OS FTP plug-in for Zowe CLI | 1.4.1 | 1.6.0 |
2. Check to see if the `master` build failed due to missing licenses.
    - If so, rerun the workflow and change the license URL to a previous version
3. Notify `Tom Zhang` on Slack and make sure to copy a link to the PR and the build that uploaded the bundles to `libs-snapshot-local` on JFrog Artifactory
4. After the RC is approved and the license zip is available, we need to update the licenses URL to the Zowe version that's about to go GA.
5. After the Zowe Release is GA, create a new branch with the version corresponding to that of the Zowe Release.

## Nightly Deployment

This repository contains a GitHub workflow that runs every night to mirror @zowe-scoped packages from Artifactory to npmjs.org. The list of packages to deploy is defined in zowe-versions.yaml.

To deploy an individual package, run the workflow zowe-cli-deploy-component.yaml. Specify the package name without the scope (e.g., `core-for-zowe-sdk`) and a space-separated list of tags to publish (e.g., `latest next`).

## External Packages

If you develop a Zowe CLI plug-in that meets the following criteria:
* External - not included in the Zowe CLI bundle
* Sourced in a repository under the Zowe GitHub organization
* Already deploys and tags new releases on Zowe Artifactory
* Authorized to publish to npmjs.org under the `@zowe` scope

Then you can follow these steps to automate publishing your plug-in to NPM:
1. Fork this repository and create a pull request that adds your package to the `extras` section of [zowe-versions.yaml](./zowe-versions.yaml). For example, to publish `@zowe/sample-plugin-for-zowe-cli`:
    ```yaml
    extras:
      sample-plugin-for-zowe-cli:
        zowe-v2-lts: true
        zowe-v3-lts: true
    ```
    This enables nightly automation to publish the "latest" (included by default), "zowe-v2-lts", and "zowe-v3-lts" tags. The list of tags should match the ones you want to publish for your plug-in.
2. (optional) In your plug-in's repository, add the following GitHub workflow:
    ```yaml
    name: Publish to NPM

    on:
      workflow_dispatch:
        inputs:
          pkg-tags:
            description: "Tags to be distributed from Artifactory (separate multiple by spaces)"
            default: "latest"
            required: true

    jobs:
      publish:
        uses: zowe/zowe-cli-standalone-package/.github/workflows/zowe-cli-deploy-component.yaml@master
        secrets:
          NPM_PUBLIC_TOKEN: ${{ secrets.NPM_PUBLIC_TOKEN }}
        with:
          pkg-name: 'sample-plugin-for-zowe-cli'
          pkg-tags: ${{ github.event.inputs.pkg-tags }}
    ```
    > **Note**
    > Replace "sample-plugin-for-zowe-cli" with the package name of your plug-in (without the `@zowe` prefix).

    This workflow can be run on demand to immediately publish your plug-in to NPM if the nightly automation is not adequate.
