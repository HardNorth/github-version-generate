# Version generation for GitHub Actions 
![CI Build](https://github.com/HardNorth/github-version-generate/workflows/CI%20Build/badge.svg?branch=master)
[![License](https://img.shields.io/badge/License-Apache%202.0-brightgreen.svg)](https://opensource.org/licenses/Apache-2.0)


A GitHub action for reading, bumping, generating, formatting applications versions in release pipelines.
Outputs three environment variables:
- 'env.CURRENT_VERSION' - a current, extracted version of application without any changes
- 'env.RELEASE_VERSION' - a generated release version with `SNAPSHOT` suffix removed by default
- 'env.NEXT_VERSION' - a new version supposed to put into version source file instead of CURRENT_VERSION

The action uses so-called "[Semantic version](https://semver.org/)" system, please check out the 
specification first to avoid misunderstanding and misuses.

By default, the action increments prerelease version. Basically it picks a number in a substring starting with 
alpha|beta|rc + a number. It also possible to notate all caps or starting with a capital letter (ALPHA, alpha and Alpha 
are OK).

E.G.:
- TESTNG7-BETA-7-SNAPSHOT &rarr; TESTNG7-BETA-8-SNAPSHOT
- rc1 &rarr; rc2
- TESTNG6-Alpha1 &rarr; Alpha2

Here are some prerelease fragments and a regex which is used to extract the prerelease number:
https://regex101.com/r/O5GUdN/2

If there is no regex match in prerelease section the patch version fragment will be incremented. You 
can force action increment a specific version fragment you like by configuring [Next version](#next-version) parameters.
If any of such parameters was specified the default behavior will be ignored.

## Usage
To use the action introduce it into your job steps of a github actions workflow.

### Example 1: Java application built with gradle
A pretty simple pipeline which launches a release task. To update development version back in a release branch Gradle 
release plugin needs at least one parameter specified (`release.newVersion`). This pipeline provides gradle both 
necessary versions: which to release and which to commit back into the release branch. 
```yaml
name: Release

on:
  push:
    branches:
    - 'master'

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Set up JDK 1.8
      uses: actions/setup-java@v1
      with:
        java-version: 1.8

    - name: Generate versions
      uses: HardNorth/github-version-generate@v1.1.2
      with:
        version-source: file
        version-file: gradle.properties
        version-file-extraction-pattern: '(?<=version=).+'

    - name: Grant execute permission for gradlew
      run: chmod +x gradlew

    - name: Release with Gradle
      id: release
      run: |
        ./gradlew release -Prelease.useAutomaticVersion=true \
        -Prelease.releaseVersion=${{ env.RELEASE_VERSION }} \
        -Prelease.newVersion=${{ env.NEXT_VERSION }}
```

### Example 2: A specific version fragment incrementation
The pipeline demonstrates how you can control which version fragment to increment by a file with a specific keyword:
```yaml
name: release

on:
  push:
    branches:
      - master

env:
  VERSION_FILE_NAME: 'VERSION'
  VERSION_BUMP_FILE: 'version_fragment'
jobs:
  calculate-version:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2

      - name: Get version fragment to bump
        id: getVersionFragment
        run: |
          read -r versionFragment < ${{ env.VERSION_BUMP_FILE }}
          echo "'$versionFragment' version will be incremented"
          echo "::set-env name=VERSION_FRAGMENT::${versionFragment}"

      - name: Generate versions
        uses: HardNorth/github-version-generate@v1.1.2
        with:
          version-source: file
          version-file: ${{ env.VERSION_FILE_NAME }}
          next-version-increment-patch: ${{ contains(env.VERSION_FRAGMENT, 'patch') }}
          next-version-increment-minor: ${{ contains(env.VERSION_FRAGMENT, 'minor') }}
          next-version-increment-major: ${{ contains(env.VERSION_FRAGMENT, 'major') }}
```
If the content of the `version_fragment` file will be "minor" then minor version will be incremented respectively.

## Configuration

### Version sources
| Parameter                       | Type                 | Default value | Description                                   |
|---------------------------------|----------------------|---------------|-----------------------------------------------|
| version-source                  | enum{file, variable} | variable      | A source of a CURRENT_VERSION                 |
| version                         | string               |               | A version variable for version source         |
| version-file                    | string               |               | A path to a file which holds a version        |
| version-file-extraction-pattern | string               | .+            | A RegEx to extract version from a version-source file. Should either match a full version, or return it as the first group. E.G: <br /><ul><li>`(?<=version=).+` - pattern match, e.g: 'version=5.0.3-SNAPSHOT' will extract matched string '5.0.3-SNAPSHOT'</li><li>`"version":\s*"([^"]+)"` - group match, will extract the first group. e.g: '"version": "1.0.0",' to '1.0.0'</li></ul>In case if there are several groups in a pattern the first group will be extracted.|

### Release version
| Parameter                               | Type    | Default value       | Description                                        |
|-----------------------------------------|---------|---------------------|----------------------------------------------------|
| release-version-cut-snapshot            | boolean | true                | Remove "SNAPSHOT" suffix from source version       |
| release-version-cut-build-metadata      | boolean | true                | Remove build metadata suffix from source version   |
| release-version-cut-prerelease          | boolean | false               | Remove prerelease part from source version         |
| release-version-generate-build-metadata | boolean | false               | Put build metadata (release date, commit sha, etc.) into result RELEASE_VERSION   |
| release-version-build-metadata-pattern  | string  | build.{date}.{hash} | Format pattern for build metadata. EG: `build.{date[YYYY-MM-dd]}.{hash[0, 6]}`. It is also possible not to customize variable outputs omitting square braces ([]) or even not to use any variables. Supported variables: <br/><ul><li>`date[date_format]`: a current date in UTC or time set in 'release-version-build-metadata-datetime' variable. Supports formatting included in square braces ([]). The date format will be applied by "Moment.js". Default format is `['YYYY-MM-DD']`.<br />Library: https://momentjs.com/ </li><li>`hash[begin_index_inclusive, end_index_exclusive]`: a commit hash, which triggered this build. You can shorten the hash by specifying begin and end characters indexes included in square braces ([]), separated by a comma. Default begin, end values are: `[0, 8]`. |
| release-version-build-metadata-datetime | string  |                     | A time stamp in ISO format to put into a build metadata string, by default the action uses current time in UTC timezone |

### Next version
| Parameter                         | Type    | Default value | Description                                         |
|-----------------------------------|---------|---------------|-----------------------------------------------------|
| next-version-increment-major      | boolean | false         | Increment major version in result NEXT_VERSION, resets all other versions to "0" and prerelease to "1" if found. E.G.: `5.0.3-BETA-3` &rarr; `6.0.0-BETA-1` |
| next-version-increment-minor      | boolean | false         | Increment minor version in result NEXT_VERSION, resets patch to "0" and prerelease to "1" if found. E.G.: `5.0.3-BETA-3` &rarr; `5.1.0-BETA-1` |
| next-version-increment-patch      | boolean | false         | Increment patch version in result NEXT_VERSION, resets prerelease to "1" if found. E.G.: `5.0.3-BETA-3` &rarr; `5.0.4-BETA-1` |
| next-version-increment-prerelease | boolean | false         | Increment prerelease version in result NEXT_VERSION. E.G.: `5.0.3-BETA-3` &rarr; `5.0.3-BETA-4` |
| next-version-cut-prerelease       | boolean | false         | Remove prerelease part from source version. In case this parameter is set the action increments patch version by default. |
| next-version-cut-build-metadata   | boolean | true          | Remove build metadata suffix from source version    |
| next-version-put-build-metadata   | boolean | false         | Put build metadata (release date, commit sha, etc.) into result NEXT_VERSION. Will be the same as for RELEASE_VERSION' |

### Real-life examples
- The action builds using itself, check out [Release](https://github.com/HardNorth/github-version-generate/blob/master/.github/workflows/release.yml) pipeline.
- [Report Portal](https://reportportal.io/) uses the action to build its agents. E.G.: [JUnit](https://github.com/reportportal/agent-java-junit/blob/master/.github/workflows/release.yml)

### License
Apache License Version 2.0 - [repo link](https://github.com/HardNorth/github-version-generate/blob/master/LICENSE).

### Credits
The action was created by [Vadzim Hushchanskou](https://github.com/HardNorth) at [HardNorth/github-version-generate](https://github.com/HardNorth/github-version-generate)
