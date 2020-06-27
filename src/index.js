"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const context = github.context;
const exec = require("@actions/exec");
const XRegExp = require("xregexp");
const fs = require("fs");
const util = require("util");

const SEMANTIC_VERSION_REGEX =
    XRegExp("^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$");

function Version(parseResultArray) {
    this.raw = parseResultArray.input;
    this.major = parseInt(parseResultArray.major);
    this.minor = parseInt(parseResultArray.minor);
    this.patch = parseInt(parseResultArray.patch);
    if (parseResultArray.prerelease) {
        this.prerelease = parseResultArray.prerelease;
    } else {
        this.prerelease = null;
    }
    if (parseResultArray.buildmetadata) {
        this.buildmetadata = parseResultArray.buildmetadata;
    } else {
        this.buildmetadata = null;
    }
}

Version.prototype.toString = function () {
    const result = [];
    result.push(this.major, ".", this.minor, ".", this.patch);
    if (this.prerelease) {
        result.push("-", this.prerelease);
    }
    if (this.buildmetadata) {
        result.push("+", this.buildmetadata);
    }
    return result.join("");
};

function getFileContents(file) {
    const readPromise = util.promisify(fs.readFile);
    return readPromise(file, {"encoding": "utf-8"});
}

function getFileVersion(versionFile, extractionPattern) {
    const fileContent = getFileContents(versionFile);

    return fileContent.then((content) => {
        const pattern = XRegExp(extractionPattern, ["g"]);
        const match = XRegExp.exec(content, pattern);

        if (match) {
            if (match.length > 1) {
                return match[1];
            } else {
                return match[0];
            }
        }
        return null;
    });
}

function parseVersion(version) {
    const result = XRegExp.exec(version, SEMANTIC_VERSION_REGEX);
    if (!result) {
        throw new Error("Unable to parse version: " + version + "; please check your version syntax, refer: https://semver.org/");
    }
    return new Version(result);
}

async function run() {
    const versionSource = core.getInput("version-source");

    let version;
    switch (versionSource) {
        case "file":
            version = await getFileVersion(core.getInput("version-file", {required: true}),
                core.getInput("version-file-extraction-pattern", {required: true}));
            break;
        case "variable":
            version = core.getInput("version");
            break;
    }

    if (!version) {
        core.setFailed("Unable to get version: null");
        return;
    }

    const parsedVersion = parseVersion(version);

}

run().catch(error => {
    core.setFailed(error.message);
});


module.exports = {
    "getFileVersion": getFileVersion,
    "parseVersion": parseVersion
};