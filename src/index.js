// eslint-disable-next-line max-classes-per-file
const core = require('@actions/core');
const github = require('@actions/github');
const XRegExp = require('xregexp');
const escape = require('escape-html');
const moment = require('moment');
const fs = require('fs');

const { context } = github;
const SEMANTIC_VERSION_REGEX = XRegExp(
  '^(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$',
);

const PRERELEASE_NUMBER_REGEX = XRegExp(
  '(?<=ALPHA|[Aa]lpha|ALPHA[-\\.]|[Aa]lpha[-\\.])[0-9]+|(?<=BETA|[Bb]eta|BETA[-\\.]|[Bb]eta[-\\.])[0-9]+|(?<=RC|[Rr]c|RC[-\\.]|[Rc]c[-\\.])[0-9]+',
);

const SNAPSHOT = 'SNAPSHOT';
const SNAPSHOT_SUFFIX_REGEX = XRegExp(`[-.]${SNAPSHOT}$`);

const METADATA_VALIDATION_PATTERN = XRegExp(
  '^(?:[0-9a-zA-Z-.]*{(?:date|hash)(?:\\[[^\\]]*\\])?})*[0-9a-zA-Z-.]*$',
);
const METADATA_VARIABLE_EXTRACTION = XRegExp('{(date|hash)(?:\\[([^\\]]*)\\])?}');
const METADATA_DEFAULT_VARIABLE_FORMAT_PATTERNS = {
  date: 'YYYY-MM-DD',
  hash: '0, 8',
};

const REGEX_PATTERN = /^\/(.*?)\/([a-zA-Z]*)$/;
const REGEX_DELIMITER = /;\s*/;

class Properties {
  constructor() {
    // Version source
    this.versionSource = core.getInput('version-source', {
      required: true,
      trimWhitespace: true,
    });
    let fileRequired = false;
    if (this.versionSource === 'file') {
      fileRequired = true;
    }
    this.versionFile = core.getInput('version-file', { required: fileRequired });
    this.versionFileExtractPattern = core.getInput(
      'version-file-extraction-pattern',
      { required: fileRequired },
    );
    this.version = core.getInput('version', { required: !fileRequired });

    // Next version put build metadata
    this.nextMetadata = core.getBooleanInput('next-version-put-build-metadata', {
      required: true,
      trimWhitespace: true,
    });

    // Release version
    this.releaseCutPrerelease = core.getBooleanInput('release-version-cut-prerelease', {
      required: true,
      trimWhitespace: true,
    });
    this.releaseCutSnapshot = core.getBooleanInput('release-version-cut-snapshot', {
      required: true,
      trimWhitespace: true,
    });
    this.releaseCutMetadata = core.getBooleanInput('release-version-cut-build-metadata', {
      required: true,
      trimWhitespace: true,
    });
    this.releaseGenerateMetadata = core.getBooleanInput('release-version-generate-build-metadata', {
      required: true,
      trimWhitespace: true,
    });
    this.releaseMetadataPattern = core.getInput(
      'release-version-build-metadata-pattern',
      { required: this.releaseGenerateMetadata || this.nextMetadata },
    );
    this.releaseMetadataTime = core.getInput('release-version-build-metadata-datetime');

    // Next version
    this.nextCutPrerelease = core.getBooleanInput('next-version-cut-prerelease', {
      required: true,
      trimWhitespace: true,
    });
    this.nextCutMetadata = core.getBooleanInput(
      'next-version-cut-build-metadata',
      { trimWhitespace: true },
    );
    this.nextIncrementMajor = core.getBooleanInput('next-version-increment-major', {
      required: true,
      trimWhitespace: true,
    });
    this.nextIncrementMinor = core.getBooleanInput('next-version-increment-minor', {
      required: true,
      trimWhitespace: true,
    });
    this.nextIncrementPatch = core.getBooleanInput('next-version-increment-patch', {
      required: true,
      trimWhitespace: true,
    });
    this.nextIncrementPrerelease = core.getBooleanInput('next-version-increment-prerelease', {
      required: true,
      trimWhitespace: true,
    });

    // Other stuff
    this.dataExtract = core.getBooleanInput('data-extract', { trimWhitespace: true });
    this.dataExtractName = core.getInput('data-extract-name');
    this.dataExtractPaths = core.getInput('data-extract-paths', {
      required: this.dataExtract,
      trimWhitespace: true,
    });
    this.dataExtractPatterns = core.getInput('data-extract-patterns', {
      required: this.dataExtract,
      trimWhitespace: true,
    });
  }
}

// Make version immutable? Will someone use as API? In collaboration?
class Version {
  constructor(parseResultArray) {
    this.raw = parseResultArray.input;
    this.major = parseInt(parseResultArray.major, 10);
    this.minor = parseInt(parseResultArray.minor, 10);
    this.patch = parseInt(parseResultArray.patch, 10);
    if (typeof parseResultArray.prerelease !== 'undefined') {
      this.prerelease = parseResultArray.prerelease;
    } else {
      this.prerelease = null;
    }
    if (typeof parseResultArray.buildmetadata !== 'undefined') {
      this.buildmetadata = parseResultArray.buildmetadata;
    } else {
      this.buildmetadata = null;
    }
  }

  updatePrerelease(reset) {
    const match = XRegExp.exec(this.prerelease, PRERELEASE_NUMBER_REGEX);
    if (match) {
      let prereleaseNumber = parseInt(match[0], 10);
      if (reset) {
        prereleaseNumber = 1;
      } else {
        prereleaseNumber += 1;
      }
      this.prerelease = this.prerelease.substring(0, match.index) + prereleaseNumber
        + this.prerelease.substring(match.index + match[0].length);
    }
  }

  incrementPrerelease() {
    this.updatePrerelease(false);
  }

  resetPrerelease() {
    this.updatePrerelease(true);
  }

  toString() {
    const result = [];
    result.push(this.major, '.', this.minor, '.', this.patch);
    if (this.prerelease) {
      result.push('-', this.prerelease);
    }
    if (this.buildmetadata) {
      result.push('+', this.buildmetadata);
    }
    return result.join('');
  }

  static parseVersion(versionStr) {
    const result = XRegExp.exec(versionStr, SEMANTIC_VERSION_REGEX);
    if (!result) {
      throw new Error(`Unable to parse version: ${escape(versionStr)}; please check your version`
        + ' syntax, refer: https://semver.org/');
    }
    return new Version(result);
  }
}

function getFileContents(file) {
  return fs.readFileSync(file)
    .toString('utf-8');
}

function getFileVersion(versionFile, extractionPattern) {
  const content = getFileContents(versionFile);
  const pattern = XRegExp(extractionPattern, 'g');
  const match = XRegExp.exec(content, pattern);

  if (match) {
    if (match.length > 1) {
      return match[1];
    }
    return match[0];
  }
  return null;
}

function generateMetadata(pattern, model) {
  const validationResult = XRegExp.exec(pattern, METADATA_VALIDATION_PATTERN);
  if (!validationResult) {
    throw new Error(`Unable to parse metadata pattern:${escape(pattern)}; please check your pattern`
      + ' syntax or ensure it doesn\'t contain incorrect symbols, see also: https://semver.org/');
  }

  let metadata = pattern;
  let variable;
  // eslint-disable-next-line no-cond-assign
  while (variable = XRegExp.exec(metadata, METADATA_VARIABLE_EXTRACTION)) {
    const word = variable[1];
    let format = variable[2];
    if (!format) {
      format = METADATA_DEFAULT_VARIABLE_FORMAT_PATTERNS[word];
    }
    if (!format) {
      throw new Error(
        `Unable to process metadata pattern: ${escape(pattern)}; unknown word: ${
          escape(word)}`,
      );
    }
    let result;
    if (word === 'date') {
      result = moment(model.date)
        .format(format.trim());
    } else {
      const formatValues = format.split(/\s*,\s*/);
      result = model.hash.substring(
        parseInt(formatValues[0].trimStart(), 10),
        parseInt(formatValues[1].trimEnd(), 10),
      );
    }
    metadata = metadata.substring(0, variable.index) + result
      + metadata.substring(variable.index + variable[0].length);
  }
  return metadata;
}

function generateReleaseVersion(currentVersion, properties) {
  const releaseVersion = new Version(currentVersion);

  if (properties.releaseCutPrerelease) {
    releaseVersion.prerelease = null;
  } else {
    // eslint-disable-next-line no-lonely-if
    if (properties.releaseCutSnapshot) {
      let { prerelease } = releaseVersion;
      if (prerelease === SNAPSHOT) {
        prerelease = null;
      } else {
        const match = XRegExp.exec(prerelease, SNAPSHOT_SUFFIX_REGEX);
        if (match) {
          prerelease = prerelease.substring(0, match.index)
            + prerelease.substring(match.index + match[0].length);
        }
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
      hash: context.sha,
    };
    releaseVersion.buildmetadata = generateMetadata(properties.releaseMetadataPattern, model);
  }
  return releaseVersion;
}

function generateNextVersion(currentVersion, releaseVersion, properties) {
  const nextVersion = new Version(currentVersion);
  if (!properties.nextIncrementPrerelease && !properties.nextIncrementPatch
    && !properties.nextIncrementMinor
    && !properties.nextIncrementMajor) {
    if (properties.nextCutPrerelease) {
      // We are going to cut prerelease, increment patch
      nextVersion.patch += 1;
    } else {
      const { prerelease } = nextVersion;
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

function toRegEx(inputStr) {
  const patternResult = XRegExp.exec(inputStr, REGEX_PATTERN);
  if (!patternResult) {
    throw new Error(`Unable to parse RegEx: ${escape(inputStr)}; please the check syntax`);
  }
  const patternStr = patternResult[1];
  const flags = patternResult[2];
  let pattern;
  try {
    pattern = XRegExp(patternStr, flags);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Unable to parse RegEx: ${escape(inputStr)}; please the check syntax: ${
        error.message}`);
    } else {
      throw new Error(
        `Unknown error occurred parsing RegEx: ${escape(inputStr)}: ${error.message}`,
      );
    }
  }
  return pattern;
}

function toRegExes(inputStr) {
  return inputStr.split(REGEX_DELIMITER)
    .map(toRegEx);
}

function toVariableName(inputStr) {
  if (inputStr == null) {
    return null;
  }
  let result = XRegExp.replace(inputStr, /[-\s]+/, '_', 'all');
  result = XRegExp.replace(result, /\W+/, '', 'all');
  return result.toUpperCase();
}

function extractData(properties) {
  const patterns = toRegExes(properties.dataExtractPatterns);
  const files = properties.dataExtractPaths.split(REGEX_DELIMITER)
    .map((file) => getFileContents(file));
  const name = toVariableName(properties.dataExtractName);
  let index = 0;
  return files.map((content) => {
    const variables = {};
    patterns.forEach((pattern) => {
      XRegExp.forEach(content, pattern, (match) => {
        if (name != null && name.trim().length > 0) {
          const idx = index;
          index += 1;
          if (idx > 0) {
            const numberedName = `${name}_${idx}`;
            if (match.length > 1) {
              // eslint-disable-next-line prefer-destructuring
              variables[numberedName] = match[1];
            } else if (match.length === 1) {
              // eslint-disable-next-line prefer-destructuring
              variables[numberedName] = match[0];
            } else {
              core.notice('Need at least 1 group or match to export variable');
            }
          } else if (match.length > 1) {
            // eslint-disable-next-line prefer-destructuring
            variables[name] = match[1];
          } else {
            // eslint-disable-next-line prefer-destructuring
            variables[name] = match[0];
          }
        } else if (match.length < 3) {
          core.notice('Need at least 2 groups to export variable with extracted name');
        } else {
          // eslint-disable-next-line prefer-destructuring
          variables[toVariableName(match[1])] = match[2];
        }
      });
    });
    return variables;
  });
}

function exportVersion(prefix, version) {
  const versionStr = version.toString();
  core.exportVariable(`${prefix}_VERSION`, versionStr);
  core.setOutput(`${prefix}_VERSION`, versionStr);
  core.exportVariable(`${prefix}_VERSION_MAJOR`, version.major);
  core.setOutput(`${prefix}_VERSION_MAJOR`, version.major);
  core.exportVariable(`${prefix}_VERSION_MINOR`, version.minor);
  core.setOutput(`${prefix}_VERSION_MINOR`, version.minor);
  core.exportVariable(`${prefix}_VERSION_PATCH`, version.patch);
  core.setOutput(`${prefix}_VERSION_PATCH`, version.patch);
  if (version.prerelease) {
    core.exportVariable(`${prefix}_VERSION_PRERELEASE`, version.prerelease);
    core.setOutput(`${prefix}_VERSION_PRERELEASE`, version.prerelease);
  }
  if (version.buildmetadata) {
    core.exportVariable(`${prefix}_VERSION_BUILDMETADATA`, version.buildmetadata);
    core.setOutput(`${prefix}_VERSION_BUILDMETADATA`, version.buildmetadata);
  }
}

async function run() {
  const properties = new Properties();

  let versionStr;
  switch (properties.versionSource) {
    case 'file':
      versionStr = getFileVersion(properties.versionFile, properties.versionFileExtractPattern);
      break;
    case 'variable':
      versionStr = properties.version;
      break;
    default:
      break;
  }

  // Check version extracted
  if (!versionStr) {
    core.setFailed('Unable to get version: null');
    return;
  }

  // Parse and set 'CURRENT_VERSION' outputs
  const parsedVersion = Version.parseVersion(versionStr);
  core.info(`Got version extracted: ${parsedVersion.toString()}`);
  exportVersion('CURRENT', parsedVersion);

  // Parse and set 'RELEASE_VERSION' outputs
  const releaseVersion = generateReleaseVersion(parsedVersion, properties);
  core.info(`Got release version: ${releaseVersion.toString()}`);
  exportVersion('RELEASE', releaseVersion);

  // Parse and set 'NEXT_VERSION' outputs
  const nextVersion = generateNextVersion(parsedVersion, releaseVersion, properties);
  core.info(`Got next version: ${nextVersion.toString()}`);
  exportVersion('NEXT', nextVersion);

  // Parse and set 'NEXT_RELEASE_VERSION' outputs
  const nextReleaseVersion = generateReleaseVersion(nextVersion, properties);
  core.info(`Got next release version: ${nextReleaseVersion.toString()}`);
  exportVersion('NEXT_RELEASE', nextReleaseVersion);

  // Parse and set extracted data
  if (!properties.dataExtract) {
    return;
  }
  extractData(properties)
    .forEach((data) => {
      const variables = Object.keys(data);
      variables.sort();
      core.info(`Got extracted data variables: ${variables.join(', ')}`);
      variables.forEach((key) => {
        core.exportVariable(key, data[key]);
        core.setOutput(key, data[key]);
      });
    });
}

run()
  .catch((error) => {
    core.setFailed(error.message);
  });

module.exports = {
  Properties,
  Version,
  getFileVersion,
  generateReleaseVersion,
  generateMetadata,
  generateNextVersion,
  toRegExes,
  toVariableName,
  extractData,
};
