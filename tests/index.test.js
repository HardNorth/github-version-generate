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

// Version parse
test("Test simple version parse", () => {
    const result = index.parseVersion("5.0.3-SNAPSHOT");
    expect(result.raw).toBe("5.0.3-SNAPSHOT");
    expect(result.major).toBe(5);
    expect(result.minor).toBe(0);
    expect(result.patch).toBe(3);
    expect(result.prerelease).toBe("SNAPSHOT");
    expect(result.buildmetadata).toBeNull();
});
