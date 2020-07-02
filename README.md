# github-version-generate
A GitHub action for reading, bumping, generating, formatting applications versions in release pipelines.
Outputs three environment variables:
- 'env.CURRENT_VERSION' - a current, extracted version of application without any changes
- 'env.RELEASE_VERSION' - a generated release version
- 'env.NEXT_VERSION' - a new version supposed to put into version source file instead of CURRENT_VERSION

The action is used so-called "[Semantic version](https://semver.org/)" system, please check out the 
specification first to avoid misunderstanding and misuses.
