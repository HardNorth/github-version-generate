"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const context = github.context;
const exec = require("@actions/exec");
const XRegExp = require("xregexp");
const escape = require("escape-html");
const moment = require("moment");
const fs = require("fs");
const util = require("util");

const SEMANTIC_VERSION_REGEX =
    XRegExp("^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$");

const PRERELEASE_SEPARATOR = "-";
const SNAPSHOT = "SNAPSHOT";
const SNAPSHOT_SUFFIX = PRERELEASE_SEPARATOR + SNAPSHOT;

const METADATA_VALIDATION_PATTERN = XRegExp("^(?:[0-9a-zA-Z-.]*{(?:date|hash)(?:\\[[^\\]]*\\])?})*[0-9a-zA-Z-.]*$");
const METADATA_VARIABLE_EXTRACTION = XRegExp("{(date|hash)(\\[[^\\]]*\\])?}");


function Properties() {
    // Version source
    this.versionSource = core.getInput("version-source", {required: true});
    let fileRequired = false;
    if (this.versionSource === "file") {
        fileRequired = true;
    }
    this.versionFile = core.getInput("version-file", {required: fileRequired});
    this.versionFileExtractPattern = core.getInput("version-file-extraction-pattern", {required: fileRequired});
    this.version = core.getInput("version", {required: !fileRequired});

    // Next version put build metadata
    this.nextMetadata = core.getInput("next-version-put-build-metadata", {required: true}) === "true";

    // Release version
    this.releaseCutSnapshot = core.getInput("release-version-cut-snapshot", {required: true}) === "true";
    this.releaseCutMetadata = core.getInput("release-version-cut-build-metadata", {required: true}) === "true";
    this.releaseGenerateMetadata = core.getInput("release-version-generate-build-metadata", {required: true}) === "true";
    this.releaseMetadataPattern = core.getInput("release-version-build-metadata-pattern", {required: this.releaseGenerateMetadata || this.nextMetadata});
    this.releaseMetadataTime = core.getInput("release-version-build-metadata-datetime");

    // Next version
    this.nextIncrementMajor = core.getInput("next-version-increment-major", {required: true}) === "true";
    this.nextIncrementMinor = core.getInput("next-version-increment-minor", {required: true}) === "true";
    this.nextIncrementPatch = core.getInput("next-version-increment-patch", {required: true}) === "true";
    this.nextIncrementPrerelease = core.getInput("next-version-increment-prerelease", {required: true}) === "true";
}

function Version(parseResultArray) {
    this.raw = parseResultArray.input;
    this.major = parseInt(parseResultArray.major);
    this.minor = parseInt(parseResultArray.minor);
    this.patch = parseInt(parseResultArray.patch);
    if (typeof parseResultArray.prerelease !== "undefined") {
        this.prerelease = parseResultArray.prerelease;
    } else {
        this.prerelease = null;
    }
    if (typeof parseResultArray.buildmetadata !== "undefined") {
        this.buildMetadata = parseResultArray.buildmetadata;
    } else {
        this.buildMetadata = null;
    }
}

Version.prototype.toString = function () {
    const result = [];
    result.push(this.major, ".", this.minor, ".", this.patch);
    if (this.prerelease) {
        result.push("-", this.prerelease);
    }
    if (this.buildMetadata) {
        result.push("+", this.buildMetadata);
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
        throw new Error("Unable to parse version: " + escape(version) + "; please check your version syntax, refer: " +
            "https://semver.org/");
    }
    return new Version(result);
}

function generateMetadata(pattern, model) {
    const validationResult = XRegExp.exec(pattern, METADATA_VALIDATION_PATTERN);
    if (!validationResult) {
        throw new Error("Unable to parse metadata pattern: " + escape(pattern) + "; please check your pattern syntax " +
            "or ensure it doesn't contain incorrect symbols, see also: https://semver.org/");
    }

    const variables = XRegExp.exec(pattern, METADATA_VARIABLE_EXTRACTION);
    if (!variables) {
        return pattern;
    }
    // TODO: finish
}

function generateReleaseVersion(currentVersion, properties) {
    const releaseVersion = new Version(currentVersion);

    if (properties.releaseCutSnapshot) {
        let prerelease = releaseVersion.prerelease;
        if (prerelease === SNAPSHOT) {
            prerelease = null;
        } else if (prerelease.endsWith(SNAPSHOT_SUFFIX)) {
            prerelease = prerelease.substring(0, prerelease.length - SNAPSHOT_SUFFIX.length);
        }
        releaseVersion.prerelease = prerelease;
    }

    if (properties.releaseCutMetadata) {
        releaseVersion.buildMetadata = null;
    }

    if (properties.releaseGenerateMetadata) {
        const model = {
            date: properties.releaseMetadataTime ? new Date(properties.releaseMetadataTime) : Date.now(),
            hash: context.sha
        };
        releaseVersion.buildMetadata = generateMetadata(properties.releaseMetadataPattern, model);
    }
    return releaseVersion;
}

async function run() {
    const properties = new Properties();

    let version;
    switch (properties.versionSource) {
        case "file":
            version = await getFileVersion(properties.versionFile, properties.versionFileExtractPattern);
            break;
        case "variable":
            version = properties.version;
            break;
    }

    // Check version extracted
    if (!version) {
        core.setFailed("Unable to get version: null");
        return;
    }

    // Parse and set 'CURRENT_VERSION' outputs
    const parsedVersion = parseVersion(version);
    const currentVersionStr = parsedVersion.toString();
    core.info("Got version extracted: " + currentVersionStr);
    core.exportVariable("CURRENT_VERSION", currentVersionStr);
    core.setOutput("CURRENT_VERSION", currentVersionStr);

    const releaseVersion = generateReleaseVersion(parsedVersion, properties);
}

run().catch(error => {
    core.setFailed(error.message);
});

module.exports = {
    "Properties": Properties,
    "Version": Version,
    "getFileVersion": getFileVersion,
    "parseVersion": parseVersion,
    "generateReleaseVersion": generateReleaseVersion
};
