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
