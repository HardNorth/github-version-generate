# Version generation for GitHub Actions 
A GitHub action for reading, bumping, generating, formatting applications versions in release pipelines.
Outputs three environment variables:
- 'env.CURRENT_VERSION' - a current, extracted version of application without any changes
- 'env.RELEASE_VERSION' - a generated release version
- 'env.NEXT_VERSION' - a new version supposed to put into version source file instead of CURRENT_VERSION

The action is used so-called "[Semantic version](https://semver.org/)" system, please check out the 
specification first to avoid misunderstanding and misuses.

## Usage
To use the action introduce it into your job steps of a github actions workflow.

For example:
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
      uses: HardNorth/github-version-generate@v1.0.0
      with:
        version-source: file
        version-file: gradle.properties
        version-file-extraction-pattern: '(?<=version=).+'
    - name: Grant execute permission for gradlew
      run: chmod +x gradlew

    - name: Release with Gradle
      id: release
      run: |
        ./gradlew release -Prelease.useAutomaticVersion=true -Prelease.releaseVersion=${{ env.RELEASE_VERSION }} \
        -Prelease.newVersion=${{ env.NEXT_VERSION }}
```

## Configuration

### Version sources
| Parameter                       | Type                 | Default value | Description                                   |
|---------------------------------|----------------------|---------------|-----------------------------------------------|
| version-source                  | enum{file, variable} | variable      | A source of a CURRENT_VERSION                 |
| version                         | string               |               | A version variable for version source         |
| version-file                    | string               |               | A path to a file with which holds a version   |
| version-file-extraction-pattern | string               | .+            | A RegEx to extract version from a version-source file. Should either match a full version, or return it as the first group. E.G: <br /><ul><li>`(?<=version=).+` - pattern match, e.g: 'version=5.0.3-SNAPSHOT' will extract matched string '5.0.3-SNAPSHOT'</li><li>`"version":\s*"([^"]+)"` - group match, will extract the first group. e.g: '"version": "1.0.0",' to '1.0.0'</li></ul>In case if there are groups in a pattern the first group will be extracted.|

### Release version
| Parameter                               | Type    | Default value       | Description                                        |
|-----------------------------------------|---------|---------------------|----------------------------------------------------|
| release-version-cut-snapshot            | boolean | true                | Remove "SNAPSHOT" suffix from source version       |
| release-version-cut-build-metadata      | boolean | true                | Remove build metadata suffix from source version   |
| release-version-generate-build-metadata | boolean | false               | Put build metadata (release date, commit sha, etc.) into result RELEASE_VERSION   |
| release-version-build-metadata-pattern  | string  | build.{date}.{hash} | Format pattern for build metadata. EG: `build.{date[YYYY-MM-dd]}.{hash[0, 6]}`. It is also possible not to customize variable outputs omitting square braces ([]) or even not to use any variables. Supported variables: <br/><ul><li>`date[date_format]`: a current date in UTC or time set in 'release-version-build-metadata-datetime' variable. Supports formatting included in square braces ([]). The date format will be applied by "Moment.js". Default format is `['YYYY-MM-DD']`.<br />Library: https://momentjs.com/ </li><li>`hash[begin_index_inclusive, end_index_exclusive]`: a commit hash, which triggered this build. You can shorten the hash by specifying begin and end characters indexes included in square braces ([]), separated by a comma. Default begin, end values are: `[0, 8]`. |
| release-version-build-metadata-datetime | string  |                     | A time stamp in ISO format to put into a build metadata string, by default the action uses current time in UTC timezone |

### Next version
| Parameter                         | Type    | Default value | Description                                         |
|-----------------------------------|---------|---------------|-----------------------------------------------------|
| next-version-increment-major      | boolean | false         | Increment major version in result NEXT_VERSION      |
| next-version-increment-minor      | boolean | false         | Increment minor version in result NEXT_VERSION      |
| next-version-increment-patch      | boolean | false         | Increment patch version in result NEXT_VERSION      |
| next-version-increment-prerelease | boolean | false         | Increment prerelease version in result NEXT_VERSION |
| next-version-cut-build-metadata   | boolean | true          | Remove build metadata suffix from source version    |
| next-version-put-build-metadata   | boolean | false         | Put build metadata (release date, commit sha, etc.) into result NEXT_VERSION. Will be the same as for RELEASE_VERSION' |

### License
Apache License Version 2.0 - [repo link](https://github.com/HardNorth/github-version-generate/blob/master/LICENSE).

### Credits
The action was created by [Vadzim Hushchanskou](https://github.com/HardNorth) at [HardNorth/github-version-generate](https://github.com/HardNorth/github-version-generate)