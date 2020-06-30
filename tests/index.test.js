const each = require("jest-each").default;

const index = require("../src/index");

describe("Test version file read successful", () => {
    each([
        ["tests/resources/simple_gradle.properties", "(?<=version=).+", "5.0.3-SNAPSHOT"],
        ["tests/resources/more_complex_gradle.properties", "(?<=version=).+", "5.0.0-BETA-16-SNAPSHOT"],
        ["tests/resources/simple_package.json", "\"version\":\\s*\"([^\"]+)\"", "1.0.0"],
        ["tests/resources/version.txt", ".+", "0.0.1-SNAPSHOT"]
    ]).it("When version file is '%s'; patters is '%s'", async (file, pattern, expectedVersion) => {
        const result = await index.getFileVersion(file, pattern);
        expect(result).toBe(expectedVersion);
    });
});

test("Test getFileVersion function throws exception on not existing file", async () => {
    const file = "resources/no_such_file.txt";
    await expect(index.getFileVersion(file, "(?<=version=).+")).rejects.toMatchObject({
        code: "ENOENT"
    });
});


describe("Test version parse successful", () => {
    each([
        ["5.0.3-SNAPSHOT", 5, 0, 3, "SNAPSHOT", null],
        ["5.0.0-BETA-16-SNAPSHOT", 5, 0, 0, "BETA-16-SNAPSHOT", null],
        ["5.0.0-BETA-16-SNAPSHOT+build.2017-03-15.3ecfad", 5, 0, 0, "BETA-16-SNAPSHOT", "build.2017-03-15.3ecfad"],
        ["5.0.0-TESTNG6-BETA-16-SNAPSHOT+build.2017-03-15.3ecfad", 5, 0, 0, "TESTNG6-BETA-16-SNAPSHOT", "build.2017-03-15.3ecfad"]
    ]).it("When versions is %s", (version, major, minor, patch, prerelease, buildMetadata) => {
        const result = index.parseVersion(version);
        expect(result.raw).toBe(version);
        expect(result.major).toBe(major);
        expect(result.minor).toBe(minor);
        expect(result.patch).toBe(patch);
        expect(result.prerelease).toBe(prerelease);
        expect(result.buildMetadata).toBe(buildMetadata);
    });
});

describe("Test toString", () => {
        each([
            ["6.5.1-SNAPSHOT", "6", "5", "1", "SNAPSHOT", undefined],
            ["1.2.3-SNAPSHOT+build.2017-02-03.3e1f4d", "1", "2", "3", "SNAPSHOT", "build.2017-02-03.3e1f4d"],
            ["100000.2341234123.12341235+build.2017-02-03.3e1f4d", 100000, 2341234123, 12341235, undefined, "build.2017-02-03.3e1f4d"],
            ["3.2.1", "3", "2", "1", undefined, undefined]
        ]).it("When version is %s", (expected, major, minor, patch, prerelease, buildMetadata) => {
            const result = new index.Version({
                "major": major,
                "minor": minor,
                "patch": patch,
                "prerelease": prerelease,
                "buildmetadata": buildMetadata
            }).toString();
            expect(result).toBe(expected);
        });
    }
);

// Properties creation

const MINIMAL_CORRECT_INPUTS = {
    "INPUT_version-source": "variable",
    "INPUT_version": "1.0.0",
    "INPUT_next-version-put-build-metadata": "false",
    "INPUT_release-version-cut-snapshot": "true",
    "INPUT_release-version-cut-build-metadata": "true",
    "INPUT_release-version-generate-build-metadata": "false",
    "INPUT_next-version-increment-major": "false",
    "INPUT_next-version-increment-minor": "false",
    "INPUT_next-version-increment-patch": "false",
    "INPUT_next-version-increment-prerelease": "false",
    "INPUT_release-version-build-metadata-pattern": "build.{date}.{hash}"
};

test("Test correct properties input, variable version source", () => {
    for (const key in MINIMAL_CORRECT_INPUTS) {
        process.env[key] = MINIMAL_CORRECT_INPUTS[key];
    }
    expect(new index.Properties()).toMatchObject({version: "1.0.0"});
});

test("Test properties fail if version-source is 'file' and no file specified", () => {
    const inputs = {MINIMAL_CORRECT_INPUTS, "INPUT_version-source": "file"};
    for (const key in inputs) {
        process.env[key] = inputs[key];
    }

    const p = () => new index.Properties();
    expect(p).toThrowError("Input required and not supplied: version-file");
});

test("Test properties fail if version-source is 'file' and no 'extraction-pattern' specified", () => {
    const inputs = {
        MINIMAL_CORRECT_INPUTS,
        "INPUT_version-source": "file",
        "INPUT_version-file": "tests/resources/version.txt"
    };

    for (const key in inputs) {
        process.env[key] = inputs[key];
    }

    const p = () => new index.Properties();
    expect(p).toThrowError("Input required and not supplied: version-file-extraction-pattern");
});

test("Test properties fail if version-source is 'variable' and no 'version' specified", () => {
    const inputs = {
        MINIMAL_CORRECT_INPUTS,
        "INPUT_version": ""
    };

    for (const key in inputs) {
        process.env[key] = inputs[key];
    }

    const p = () => new index.Properties();
    expect(p).toThrowError("Input required and not supplied: version");
});

// Metadata generation

const METADATA_TEST_CASES = [
    "build.{date}.{hash}",
    "build.{date[YYYY-MM-dd]}.{hash}",
    "build.{date[YYYY-MM-dd]}.{hash[0,6]}",
    "build.{date[ YYYY-MM-dd ]}.{hash[ 0, 6 ]}",
    "{date}-{hash}-something",
    "build-{date}-{hash}",
    "build.{date}.hash.{hash}",
    "{date}.{hash[0,6]}",
    "build.2342234."
];
