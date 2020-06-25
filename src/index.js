'use strict';

const SEMANTIC_VERSION_REGEX =
    XRegExp('/^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$/')

const core = require('@actions/core');
const github = require('@actions/github');
const context = github.context;
const exec = require('@actions/exec');

async function getFileVersion() {
    let versionFile = core.getInput('version-file', {required: true});
    let extractionPattern = core.getInput('version-file-extraction-pattern', {required: true});
    let myOutput = '';
    let myError = '';
    let options = {};
    options.listeners = {
        stdout: (data) => {
            myOutput += data.toString();
        },
        stderr: (data) => {
            myError += data.toString();
        }
    };
    await exec.exec('cat', [versionFile], options)

}

async function run() {
    let versionSource = core.getInput('version-source');

    let version;
    switch (versionSource) {
        case 'file':
            version = await getFileVersion();
            break;
        case 'variable':
            version = core.getInput('version');
            break;
    }
}

run().catch(error => {
    core.setFailed(error.message);
});
