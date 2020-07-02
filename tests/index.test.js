process.env["GITHUB_SHA"] = "8278cdafa198a07b718945a97602bbffa5511f2b";

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
    ]).it("When versions is %s", (version, major, minor, patch, prerelease, buildmetadata) => {
        const result = index.parseVersion(version);
        expect(result.raw).toBe(version);
        expect(result.major).toBe(major);
        expect(result.minor).toBe(minor);
        expect(result.patch).toBe(patch);
        expect(result.prerelease).toBe(prerelease);
        expect(result.buildmetadata).toBe(buildmetadata);
    });
});

describe("Test toString", () => {
        each([
            ["6.5.1-SNAPSHOT", "6", "5", "1", "SNAPSHOT", undefined],
            ["1.2.3-SNAPSHOT+build.2017-02-03.3e1f4d", "1", "2", "3", "SNAPSHOT", "build.2017-02-03.3e1f4d"],
            ["100000.2341234123.12341235+build.2017-02-03.3e1f4d", 100000, 2341234123, 12341235, undefined, "build.2017-02-03.3e1f4d"],
            ["3.2.1", "3", "2", "1", undefined, undefined]
        ]).it("When version is %s", (expected, major, minor, patch, prerelease, buildmetadata) => {
            const result = new index.Version({
                "major": major,
                "minor": minor,
                "patch": patch,
                "prerelease": prerelease,
                "buildmetadata": buildmetadata
            }).toString();
            expect(result).toBe(expected);
        });
    }
);

// Properties creation

const MINIMAL_CORRECT_INPUTS = {
    "INPUT_VERSION-SOURCE": "variable",
    "INPUT_VERSION": "1.0.0",
    "INPUT_RELEASE-VERSION-CUT-SNAPSHOT": "true",
    "INPUT_RELEASE-VERSION-CUT-BUILD-METADATA": "true",
    "INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA": "false",
    "INPUT_NEXT-VERSION-INCREMENT-MAJOR": "false",
    "INPUT_NEXT-VERSION-INCREMENT-MINOR": "false",
    "INPUT_NEXT-VERSION-INCREMENT-PATCH": "false",
    "INPUT_NEXT-VERSION-INCREMENT-PRERELEASE": "false",
    "INPUT_RELEASE-VERSION-BUILD-METADATA-PATTERN": "build.{date}.{hash}",
    "INPUT_NEXT-VERSION-CUT-BUILD-METADATA": "true",
    "INPUT_NEXT-VERSION-PUT-BUILD-METADATA": "false"
};

test("Test correct properties input, variable version source", () => {
    for (const key in MINIMAL_CORRECT_INPUTS) {
        process.env[key] = MINIMAL_CORRECT_INPUTS[key];
    }
    expect(new index.Properties()).toMatchObject({version: "1.0.0"});
});

test("Test properties fail if version-source is 'file' and no file specified", () => {
    const inputs = {MINIMAL_CORRECT_INPUTS, "INPUT_VERSION-SOURCE": "file"};
    for (const key in inputs) {
        process.env[key] = inputs[key];
    }

    const p = () => new index.Properties();
    expect(p).toThrowError("Input required and not supplied: version-file");
});

test("Test properties fail if version-source is 'file' and no 'extraction-pattern' specified", () => {
    const inputs = {
        MINIMAL_CORRECT_INPUTS,
        "INPUT_VERSION-SOURCE": "file",
        "INPUT_VERSION-FILE": "tests/resources/version.txt"
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
        "INPUT_VERSION": ""
    };

    for (const key in inputs) {
        process.env[key] = inputs[key];
    }

    const p = () => new index.Properties();
    expect(p).toThrowError("Input required and not supplied: version");
});

// Metadata generation

const METADATA_DEFAULT_MODEL = {
    date: new Date(2020, 2, 2, 17, 33, 3),
    hash: "622161f9e2993288c026f9c8eb71a0659ed933ee"
};

const METADATA_TEST_CASES = [
    ["build.{date}.{hash}", "build.2017-03-02.622161f9", {
        ...METADATA_DEFAULT_MODEL,
        date: new Date(2017, 2, 2, 17, 33, 3)
    }],
    ["build.{date[YYYY-MM-dd-HH]}.{hash}", "build.2020-03-Mo-17.622161f9", METADATA_DEFAULT_MODEL],
    ["build.{date[YYYY.MM]}.{hash[0,10]}", "build.2020.08.7c8146ed9b", {
        date: new Date(2020, 7, 2, 17, 33, 3),
        hash: "7c8146ed9b99476e4e53e97f3ebd9a4b24a69c3d"
    }],
    ["build.{date[ YYYY-MM-DD ]}.{hash[ 0, 10 ]}", "build.2020-03-02.622161f9e2", METADATA_DEFAULT_MODEL],
    ["{date}-{hash}-something", "2020-03-02-7c8146ed-something", {
        ...METADATA_DEFAULT_MODEL,
        hash: "7c8146ed9b99476e4e53e97f3ebd9a4b24a69c3d"
    }],
    ["build-{date}-{hash}", "build-2020-03-02-622161f9", METADATA_DEFAULT_MODEL],
    ["build.{date}.hash.{hash}", "build.2020-03-02.hash.622161f9", METADATA_DEFAULT_MODEL],
    ["{date}.{hash[0,6]}", "2020-03-02.622161", METADATA_DEFAULT_MODEL],
    ["build.2342234.", "build.2342234.", METADATA_DEFAULT_MODEL],
    ["{date}.{hash[0,10000000000000000000]}", "2020-03-02.622161f9e2993288c026f9c8eb71a0659ed933ee", METADATA_DEFAULT_MODEL],
    ["{date}.{hash[-1000,6]}", "2020-03-02.622161", METADATA_DEFAULT_MODEL],
    ["{date}.{hash[10000000000000000000, 0]}", "2020-03-02.622161f9e2993288c026f9c8eb71a0659ed933ee", METADATA_DEFAULT_MODEL]
];

describe("Test metadata generation with different patterns", () => {
    each(METADATA_TEST_CASES).it("When pattern is '%s'", (pattern, expected, model) => {
        const result = index.generateMetadata(pattern, model);
        expect(result).toBe(expected);
    });
});

// Release version generation

const DATE = new Date(Date.now());
const PAST_DATE = new Date(2017, 2, 4, 17, 33, 53);
const DATE_FORMAT = new Intl.NumberFormat("en-US", {"minimumIntegerDigits": 2});

const CURRENT_VERSION = new index.Version({
    input: "1.2.3-BETA-7-SNAPSHOT+build.2017-02-03.3e1f4d",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "BETA-7-SNAPSHOT",
    buildmetadata: "build.2017-02-03.3e1f4d"
});

const INCORRECT_SNAPSHOT_VERSION = new index.Version({
    input: "1.2.3-BETA-SNAPSHOT-7+build.2017-02-03.3e1f4d",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "BETA-SNAPSHOT-7",
    buildmetadata: "build.2017-02-03.3e1f4d"
});

const RELEASE_VERSION_TEST_CASES = [
    [{}, CURRENT_VERSION, "1.2.3-BETA-7"],
    [{"INPUT_RELEASE-VERSION-CUT-BUILD-METADATA": "false"}, CURRENT_VERSION, "1.2.3-BETA-7+build.2017-02-03.3e1f4d"],
    [{
        "INPUT_RELEASE-VERSION-CUT-SNAPSHOT": "false",
        "INPUT_RELEASE-VERSION-CUT-BUILD-METADATA": "false"
    }, CURRENT_VERSION, "1.2.3-BETA-7-SNAPSHOT+build.2017-02-03.3e1f4d"],
    [{"INPUT_RELEASE-VERSION-CUT-SNAPSHOT": "false"}, CURRENT_VERSION, "1.2.3-BETA-7-SNAPSHOT"],
    [{}, INCORRECT_SNAPSHOT_VERSION, "1.2.3-BETA-SNAPSHOT-7"],
    [{
        "INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA": "true"
    }, CURRENT_VERSION, "1.2.3-BETA-7+build." + DATE.getUTCFullYear() + "-" + DATE_FORMAT.format(DATE.getUTCMonth() + 1) + "-" + DATE_FORMAT.format(DATE.getUTCDate()) + ".8278cdaf"],
    [{
        "INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA": "true",
        "INPUT_RELEASE-VERSION-BUILD-METADATA-DATETIME": PAST_DATE.toISOString()
    }, CURRENT_VERSION, "1.2.3-BETA-7+build." + PAST_DATE.getUTCFullYear() + "-" + DATE_FORMAT.format(PAST_DATE.getUTCMonth() + 1) + "-" + DATE_FORMAT.format(PAST_DATE.getUTCDate()) + ".8278cdaf"],
    [{
        "INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA": "true",
        "INPUT_RELEASE-VERSION-BUILD-METADATA-DATETIME": PAST_DATE.getFullYear() + "-" + (PAST_DATE.getMonth() + 1) + "-" + PAST_DATE.getDate()
    }, CURRENT_VERSION, "1.2.3-BETA-7+build." + PAST_DATE.getUTCFullYear() + "-" + DATE_FORMAT.format(PAST_DATE.getUTCMonth() + 1) + "-" + DATE_FORMAT.format(PAST_DATE.getUTCDate()) + ".8278cdaf"]
];

describe("Test release version generation with different properties", () => {
    each(RELEASE_VERSION_TEST_CASES).it("When inputs are '%s'; and version is: '%s'; expected is '%s'", (inputs, currentVersion, expected) => {
        for (const key in MINIMAL_CORRECT_INPUTS) {
            process.env[key] = MINIMAL_CORRECT_INPUTS[key];
        }
        for (const key in inputs) {
            process.env[key] = inputs[key];
        }

        const result = index.generateReleaseVersion(currentVersion, new index.Properties()).toString();
        expect(result).toBe(expected);
    });
});

// NEXT_VERSION generation

PRERELEASE_INCREMENT_TEST_CASES = [
    [new index.Version(CURRENT_VERSION), "1.2.3-BETA-8-SNAPSHOT+build.2017-02-03.3e1f4d"],
    [new index.Version(INCORRECT_SNAPSHOT_VERSION), "1.2.3-BETA-SNAPSHOT-7+build.2017-02-03.3e1f4d"],
    [new index.Version({
        ...CURRENT_VERSION,
        prerelease: "TESTNG7-BETA-7-SNAPSHOT"
    }), "1.2.3-TESTNG7-BETA-8-SNAPSHOT+build.2017-02-03.3e1f4d"],
    [new index.Version({...CURRENT_VERSION, prerelease: "TESTNG6-RC1"}), "1.2.3-TESTNG6-RC2+build.2017-02-03.3e1f4d"],
    [new index.Version({...CURRENT_VERSION, prerelease: "TESTNG6-RC-1"}), "1.2.3-TESTNG6-RC-2+build.2017-02-03.3e1f4d"]
];

describe("Test prerelease increments", () => {
    beforeAll(() => {
        for (const key in MINIMAL_CORRECT_INPUTS) {
            process.env[key] = MINIMAL_CORRECT_INPUTS[key];
        }
    });
    each(PRERELEASE_INCREMENT_TEST_CASES).it("When version is: '%s'; result should be: '%s'", (input, expected) => {
        index.incrementPrerelease(input);
        expect(input.toString()).toBe(expected);
    });
});

const RELEASE_VERSION = new index.Version({
    input: "1.2.3-BETA-7",
    major: "1",
    minor: "2",
    patch: "3",
    prerelease: "BETA-7",
    buildmetadata: "build.2017-02-04.5e2079"
});

const NEXT_VERSION_TEST_CASES = [
    [{}, CURRENT_VERSION, RELEASE_VERSION, "1.2.3-BETA-8-SNAPSHOT"],
    [{"INPUT_NEXT-VERSION-PUT-BUILD-METADATA": "true"}, CURRENT_VERSION, RELEASE_VERSION, "1.2.3-BETA-8-SNAPSHOT+build.2017-02-04.5e2079"],
    [{"INPUT_NEXT-VERSION-INCREMENT-PATCH": "true"}, CURRENT_VERSION, RELEASE_VERSION, "1.2.4-BETA-7-SNAPSHOT"],
    [{"INPUT_NEXT-VERSION-INCREMENT-MINOR": "true"}, CURRENT_VERSION, RELEASE_VERSION, "1.3.3-BETA-7-SNAPSHOT"],
    [{"INPUT_NEXT-VERSION-INCREMENT-MAJOR": "true"}, CURRENT_VERSION, RELEASE_VERSION, "2.2.3-BETA-7-SNAPSHOT"],
    [{"INPUT_NEXT-VERSION-INCREMENT-PRERELEASE": "true"}, new index.Version({
        ...CURRENT_VERSION,
        prerelease: "SNAPSHOT"
    }), RELEASE_VERSION, "1.2.3-SNAPSHOT"],
    [{
        "INPUT_NEXT-VERSION-INCREMENT-MAJOR": "true",
        "INPUT_NEXT-VERSION-INCREMENT-PRERELEASE": "true"
    }, CURRENT_VERSION, RELEASE_VERSION, "2.2.3-BETA-8-SNAPSHOT"]
];
describe("Test next version generation with different properties", () => {
    each(NEXT_VERSION_TEST_CASES).it("When inputs are '%s'; and current version is: '%s'; and release version is: '%s'; expected is '%s'", (inputs, currentVersion, releaseVersion, expected) => {
        for (const key in MINIMAL_CORRECT_INPUTS) {
            process.env[key] = MINIMAL_CORRECT_INPUTS[key];
        }
        for (const key in inputs) {
            process.env[key] = inputs[key];
        }

        const result = index.generateNextVersion(currentVersion, releaseVersion, new index.Properties()).toString();
        expect(result).toBe(expected);
    });
});
