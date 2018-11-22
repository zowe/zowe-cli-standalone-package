# Zowe CLI Standalone Package Pipeline

This repository pulls the latest Zowe CLI and Zowe CLI Plugin Artifacts from Artifactory, and generates a standalone ZIP file containing the contents.

The standalone ZIP is intended to be offline-installable for those users who are unable to connect to public NPM registries. The Zowe CLI DB2 Plugin is the lone exception, as this plugin has dependencies on ODBC drivers and DDB licenses which much be obtained by users separately. See the official Zowe Documentation for more information.