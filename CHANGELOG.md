# Changelog

## [Unreleased]

## [1.4.0]
### Changed
- Node.js version updated on 20, by @HardNorth
- Minor version updated on `1.4`, by @HardNorth
- Move common logic to `app.js` file to avoid running application on import, by @HardNorth

## [1.3.0]
### Changed
- Node.js version updated on 16, by @HardNorth
- `@actions/core` and `@actions/github` versions updated on 1.10.0 and 5.1.1 respectively, by @HardNorth
- Minor version updated on `1.3`, by @HardNorth

## [1.2.0]
### Added
- [Issue #24](https://github.com/HardNorth/github-version-generate/issues/24) Data extraction, by @HardNorth
- [Issue #31](https://github.com/HardNorth/github-version-generate/issues/31) Major, Minor, Patch, Prerelease, Buildmetadata fragments export, by @HardNorth
- [Issue #34](https://github.com/HardNorth/github-version-generate/issues/34) `NEXT_RELEASE_VERSION` variable export, by @HardNorth
### Changed
- Minor version updated on `1.2` 
- Some security fixes, by @dependabot

## [1.1.2]
### Changed
- Some security fixes, by @dependabot

## [1.1.1]
### Changed
- Some indirect dependencies were updated by dependabot

## [1.1.0]
### Added
- `release-version-cut-prerelease` parameter
- `next-version-cut-prerelease` parameter

## [1.0.2]
### Changed
- Refactoring, making code more ES6-ish.
- The Action dependencies were updated due to security issues found, see: https://github.blog/changelog/2020-10-01-github-actions-deprecating-set-env-and-add-path-commands/

## [1.0.1]
### Fixed
- Version reset if a version of a greater value incremented

## [1.0.0]
### Added
- Initial release, see README.md for the list of features
