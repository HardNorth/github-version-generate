"use strict";

const core = require("@actions/core");
const github = require("@actions/github");
const context = github.context;
const XRegExp = require("xregexp");
const escape = require("escape-html");
const moment = require("moment");
const fs = require("fs");
const util = require("util");

const SEMANTIC_VERSION_REGEX =
    XRegExp("^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$");

const PRERELEASE_NUMBER_REGEX =
    XRegExp("(?<=ALPHA|[Aa]lpha|ALPHA[-\\.]|[Aa]lpha[-\\.])[0-9]+|(?<=BETA|[Bb]eta|BETA[-\\.]|[Bb]eta[-\\.])[0-9]+|(?<=RC|[Rr]c|RC[-\\.]|[Rc]c[-\\.])[0-9]+");

const SNAPSHOT = "SNAPSHOT";
const SNAPSHOT_SUFFIX_REGEX = XRegExp("[-\.]" + SNAPSHOT + "$");

const METADATA_VALIDATION_PATTERN = XRegExp("^(?:[0-9a-zA-Z-.]*{(?:date|hash)(?:\\[[^\\]]*\\])?})*[0-9a-zA-Z-.]*$");
const METADATA_VARIABLE_EXTRACTION = XRegExp("{(date|hash)(?:\\[([^\\]]*)\\])?}");
const METADATA_DEFAULT_VARIABLE_FORMAT_PATTERNS = {
    date: "YYYY-MM-DD",
    hash: "0, 8"
};

class Properties {
    constructor() {
        // Version source
        this.versionSource = core.getInput("version-source", {required: true, trimWhitespace: true});
        let fileRequired = false;
        if (this.versionSource === "file") {
            fileRequired = true;
        }
        this.versionFile = core.getInput("version-file", {required: fileRequired});
        this.versionFileExtractPattern = core.getInput("version-file-extraction-pattern", {required: fileRequired});
        this.version = core.getInput("version", {required: !fileRequired});

        // Next version put build metadata
        this.nextMetadata = core.getBooleanInput("next-version-put-build-metadata", {required: true, trimWhitespace: true});

        // Release version
        this.releaseCutPrerelease = core.getBooleanInput("release-version-cut-prerelease", {required: true, trimWhitespace: true});
        this.releaseCutSnapshot = core.getBooleanInput("release-version-cut-snapshot", {required: true, trimWhitespace: true});
        this.releaseCutMetadata = core.getBooleanInput("release-version-cut-build-metadata", {required: true, trimWhitespace: true});
        this.releaseGenerateMetadata = core.getBooleanInput("release-version-generate-build-metadata", {required: true, trimWhitespace: true});
        this.releaseMetadataPattern = core.getInput("release-version-build-metadata-pattern", {required: this.releaseGenerateMetadata || this.nextMetadata});
        this.releaseMetadataTime = core.getInput("release-version-build-metadata-datetime");

        // Next version
        this.nextCutPrerelease = core.getBooleanInput("next-version-cut-prerelease", {required: true, trimWhitespace: true});
        this.nextCutMetadata = core.getBooleanInput("next-version-cut-build-metadata", {trimWhitespace: true});
        this.nextIncrementMajor = core.getBooleanInput("next-version-increment-major", {required: true, trimWhitespace: true});
        this.nextIncrementMinor = core.getBooleanInput("next-version-increment-minor", {required: true, trimWhitespace: true});
        this.nextIncrementPatch = core.getBooleanInput("next-version-increment-patch", {required: true, trimWhitespace: true});
        this.nextIncrementPrerelease = core.getBooleanInput("next-version-increment-prerelease", {required: true, trimWhitespace: true});

        // Other stuff
        this.dataExtractStr = core.getInput("data-extract");
    }
}

// Make version immutable? Will someone use as API? In collaboration?
class Version {
    constructor(parseResultArray) {
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
            this.buildmetadata = parseResultArray.buildmetadata;
        } else {
            this.buildmetadata = null;
        }
    }

    _updatePrerelease(reset) {
        let match = XRegExp.exec(this.prerelease, PRERELEASE_NUMBER_REGEX);
        if (match) {
            let prereleaseNumber = parseInt(match[0]);
            if (reset) {
                prereleaseNumber = 1;
            } else {
                prereleaseNumber += 1;
            }
            this.prerelease = this.prerelease.substring(0, match["index"]) + prereleaseNumber +
                this.prerelease.substring(match["index"] + match[0].length);
        }
    }

    incrementPrerelease() {
        this._updatePrerelease(false);
    }

    resetPrerelease() {
        this._updatePrerelease(true);
    }

    toString() {
        const result = [];
        result.push(this.major, ".", this.minor, ".", this.patch);
        if (this.prerelease) {
            result.push("-", this.prerelease);
        }
        if (this.buildmetadata) {
            result.push("+", this.buildmetadata);
        }
        return result.join("");
    }

    static parseVersion(versionStr) {
        const result = XRegExp.exec(versionStr, SEMANTIC_VERSION_REGEX);
        if (!result) {
            throw new Error("Unable to parse version: " + escape(versionStr) + "; please check your version syntax, refer: " +
                "https://semver.org/");
        }
        return new Version(result);
    }
}

function getFileContents(file) {
    const readPromise = util.promisify(fs.readFile);
    return readPromise(file);
}

function getFileVersion(versionFile, extractionPattern) {
    const fileContent = getFileContents(versionFile);

    return fileContent.then((content) => {
        const pattern = XRegExp(extractionPattern, "g");
        const match = XRegExp.exec(content.toString("utf-8"), pattern);

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

function generateMetadata(pattern, model) {
    const validationResult = XRegExp.exec(pattern, METADATA_VALIDATION_PATTERN);
    if (!validationResult) {
        throw new Error("Unable to parse metadata pattern: " + escape(pattern) + "; please check your pattern syntax " +
            "or ensure it doesn't contain incorrect symbols, see also: https://semver.org/");
    }

    let metadata = pattern;
    let variable;
    while (variable = XRegExp.exec(metadata, METADATA_VARIABLE_EXTRACTION)) {
        const word = variable[1];
        let format = variable[2];
        if (!format) {
            format = METADATA_DEFAULT_VARIABLE_FORMAT_PATTERNS[word];
        }
        if (!format) {
            throw new Error("Unable to process metadata pattern: " + escape(pattern) + "; unknown word: " +
                escape(word));
        }
        let result;
        if (word === "date") {
            result = moment(model["date"]).format(format.trim());
        } else {
            const formatValues = format.split(/\s*,\s*/);
            result = model["hash"].substring(parseInt(formatValues[0].trimStart()), parseInt(formatValues[1].trimEnd()));
        }
        metadata = metadata.substring(0, variable["index"]) + result + metadata.substring(variable["index"] + variable[0].length);
    }
    return metadata;
}

function generateReleaseVersion(currentVersion, properties) {
    const releaseVersion = new Version(currentVersion);

    if (properties.releaseCutPrerelease) {
        releaseVersion.prerelease = null;
    } else {
        let match;
        if (properties.releaseCutSnapshot) {
            let prerelease = releaseVersion.prerelease;
            if (prerelease === SNAPSHOT) {
                prerelease = null;
            } else if ((match = XRegExp.exec(prerelease, SNAPSHOT_SUFFIX_REGEX))) {
                prerelease = prerelease.substring(0, match["index"]) + prerelease.substring(match["index"] + match[0].length);
            }
            releaseVersion.prerelease = prerelease;
        }
    }

    if (properties.releaseCutMetadata) {
        releaseVersion.buildmetadata = null;
    }

    if (properties.releaseGenerateMetadata) {
        const model = {
            date: properties.releaseMetadataTime ? properties.releaseMetadataTime : Date.now(),
            hash: context.sha
        };
        releaseVersion.buildmetadata = generateMetadata(properties.releaseMetadataPattern, model);
    }
    return releaseVersion;
}

function generateNextVersion(currentVersion, releaseVersion, properties) {
    const nextVersion = new Version(currentVersion);
    if (!properties.nextIncrementPrerelease && !properties.nextIncrementPatch && !properties.nextIncrementMinor
        && !properties.nextIncrementMajor) {
        if(properties.nextCutPrerelease) {
            // We are going to cut prerelease, increment patch
            nextVersion.patch += 1;
        } else {
            let prerelease = nextVersion.prerelease;
            nextVersion.incrementPrerelease();
            if (prerelease === nextVersion.prerelease) {
                // Nothing to increment, increment patch
                nextVersion.patch += 1;
            }
        }
    } else {
        if (properties.nextIncrementPrerelease) {
            nextVersion.incrementPrerelease();
        }
        if (properties.nextIncrementPatch) {
            nextVersion.resetPrerelease();
            nextVersion.patch += 1;
        }
        if (properties.nextIncrementMinor) {
            nextVersion.resetPrerelease();
            nextVersion.patch = 0;
            nextVersion.minor += 1;
        }
        if (properties.nextIncrementMajor) {
            nextVersion.resetPrerelease();
            nextVersion.minor = 0;
            nextVersion.patch = 0;
            nextVersion.major += 1;
        }
    }
    if (properties.nextCutPrerelease) {
        nextVersion.prerelease = null;
    }
    if (properties.nextCutMetadata) {
        nextVersion.buildmetadata = null;
    }
    if (properties.nextMetadata) {
        nextVersion.buildmetadata = releaseVersion.buildmetadata;
    }
    return nextVersion;
}

async function run() {
    const properties = new Properties();

    core.notice("Got 'data-extract': " + properties.dataExtractStr);

    let versionStr;
    switch (properties.versionSource) {
        case "file":
            versionStr = await getFileVersion(properties.versionFile, properties.versionFileExtractPattern);
            break;
        case "variable":
            versionStr = properties.version;
            break;
    }

    // Check version extracted
    if (!versionStr) {
        core.setFailed("Unable to get version: null");
        return;
    }

    // Parse and set 'CURRENT_VERSION' outputs
    const parsedVersion = Version.parseVersion(versionStr);
    const currentVersionStr = parsedVersion.toString();
    core.info("Got version extracted: " + currentVersionStr);
    core.exportVariable("CURRENT_VERSION", currentVersionStr);
    core.setOutput("CURRENT_VERSION", currentVersionStr);

    // Parse and set 'RELEASE_VERSION' outputs
    const releaseVersion = generateReleaseVersion(parsedVersion, properties);
    const releaseVersionStr = releaseVersion.toString();
    core.info("Got release version: " + releaseVersionStr);
    core.exportVariable("RELEASE_VERSION", releaseVersionStr);
    core.setOutput("RELEASE_VERSION", releaseVersionStr);

    // Parse and set 'NEXT_VERSION' outputs
    const nextVersion = generateNextVersion(parsedVersion, releaseVersion, properties);
    const nextVersionStr = nextVersion.toString();
    core.info("Got next version: " + nextVersionStr);
    core.exportVariable("NEXT_VERSION", nextVersionStr);
    core.setOutput("NEXT_VERSION", nextVersionStr);
}

run().catch(error => {
    core.setFailed(error.message);
});

module.exports = {
    "Properties": Properties,
    "Version": Version,
    "getFileVersion": getFileVersion,
    "generateReleaseVersion": generateReleaseVersion,
    "generateMetadata": generateMetadata,
    "generateNextVersion": generateNextVersion
};
