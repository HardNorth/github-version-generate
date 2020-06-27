const each = require("jest-each").default;

const index = require("../src/index");

// Version file read
test("Test simple property file version extraction by match", async () => {
    const result = await index.getFileVersion("tests/resources/simple_gradle.properties", "(?<=version=).+");
    expect(result).toBe("5.0.3-SNAPSHOT");
});

test("Test simple property file version extraction by group", async () => {
    const result = await index.getFileVersion("tests/resources/simple_package.json", "\"version\":\\s*\"([^\"]+)\"");
    expect(result).toBe("1.0.0");
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
    ]).it("When versions is %s", (version, major, minor, patch, prerelease, buildmetadata) => {
        const result = index.parseVersion(version);
        expect(result.raw).toBe(version);
        expect(result.major).toBe(major);
        expect(result.minor).toBe(minor);
        expect(result.patch).toBe(patch);
        expect(result.prerelease).toBe(prerelease);
        expect(result.buildmetadata).toBe(buildmetadata);
    })
});

