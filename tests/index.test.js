const each = require("jest-each").default;

const index = require("../src/index");

describe("Test version file read successful", () =>{
   each([
       ["tests/resources/simple_gradle.properties", "(?<=version=).+", "5.0.3-SNAPSHOT"],
       ["tests/resources/more_complex_gradle.properties", "(?<=version=).+", "5.0.0-BETA-16-SNAPSHOT"],
       ["tests/resources/simple_package.json", "\"version\":\\s*\"([^\"]+)\"", "1.0.0"],
   ]).it("When version file is '%s'; patters is '%s'", async (file, pattern, expectedVersion) => {
       const result = await index.getFileVersion(file, pattern);
       expect(result).toBe(expectedVersion);
   })
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
    })
});

