process.env.GITHUB_SHA = '8278cdafa198a07b718945a97602bbffa5511f2b';

const each = require('jest-each').default;

const {
  beforeAll,
  describe,
  test,
  expect,
} = require('@jest/globals');
const XRegExp = require('xregexp');
const app = require('../src/app');

describe('Test version file read successful', () => {
  each([
    ['tests/resources/simple_gradle.properties', '(?<=version=).+', '5.0.3-SNAPSHOT'],
    ['tests/resources/more_complex_gradle.properties', '(?<=version=).+', '5.0.0-BETA-16-SNAPSHOT'],
    ['tests/resources/simple_package.json', '"version":\\s*"([^"]+)"', '1.0.0'],
    ['tests/resources/version.txt', '.+', '0.0.1-SNAPSHOT'],
  ])
    .it('When version file is \'%s\'; patters is \'%s\'', (file, pattern, expectedVersion) => {
      const result = app.getFileVersion(file, pattern);
      expect(result)
        .toBe(expectedVersion);
    });
});

test('Test getFileVersion function throws exception on not existing file', () => {
  const file = 'resources/no_such_file.txt';

  expect(() => app.getFileVersion(file, '(?<=version=).+'))
    .toThrowError('ENOENT: no such file or directory');
});

describe('Test version parse successful', () => {
  each([
    ['5.0.3-SNAPSHOT', 5, 0, 3, 'SNAPSHOT', null],
    ['5.0.0-BETA-16-SNAPSHOT', 5, 0, 0, 'BETA-16-SNAPSHOT', null],
    [
      '5.0.0-BETA-16-SNAPSHOT+build.2017-03-15.3ecfad',
      5,
      0,
      0,
      'BETA-16-SNAPSHOT',
      'build.2017-03-15.3ecfad'],
    [
      '5.0.0-TESTNG6-BETA-16-SNAPSHOT+build.2017-03-15.3ecfad',
      5,
      0,
      0,
      'TESTNG6-BETA-16-SNAPSHOT',
      'build.2017-03-15.3ecfad'],
    ['0.0.1-ALPHA-SNAPSHOT', 0, 0, 1, 'ALPHA-SNAPSHOT', null],
  ])
    .it('When versions is %s', (version, major, minor, patch, prerelease, buildmetadata) => {
      const result = app.Version.parseVersion(version);
      expect(result.raw)
        .toBe(version);
      expect(result.major)
        .toBe(major);
      expect(result.minor)
        .toBe(minor);
      expect(result.patch)
        .toBe(patch);
      expect(result.prerelease)
        .toBe(prerelease);
      expect(result.buildmetadata)
        .toBe(buildmetadata);
    });
});

describe('Test toString', () => {
  each([
    ['6.5.1-SNAPSHOT', '6', '5', '1', 'SNAPSHOT', undefined],
    [
      '1.2.3-SNAPSHOT+build.2017-02-03.3e1f4d',
      '1',
      '2',
      '3',
      'SNAPSHOT',
      'build.2017-02-03.3e1f4d'],
    [
      '100000.2341234123.12341235+build.2017-02-03.3e1f4d',
      100000,
      2341234123,
      12341235,
      undefined,
      'build.2017-02-03.3e1f4d'],
    ['3.2.1', '3', '2', '1', undefined, undefined],
  ])
    .it('When version is %s', (expected, major, minor, patch, prerelease, buildmetadata) => {
      const result = new app.Version({
        major,
        minor,
        patch,
        prerelease,
        buildmetadata,
      }).toString();
      expect(result)
        .toBe(expected);
    });
});

// Properties creation

const MINIMAL_CORRECT_INPUTS = {
  'INPUT_VERSION-SOURCE': 'variable',
  INPUT_VERSION: '1.0.0',
  'INPUT_RELEASE-VERSION-CUT-SNAPSHOT': 'true',
  'INPUT_RELEASE-VERSION-CUT-BUILD-METADATA': 'true',
  'INPUT_RELEASE-VERSION-CUT-PRERELEASE': 'false',
  'INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA': 'false',
  'INPUT_NEXT-VERSION-INCREMENT-MAJOR': 'false',
  'INPUT_NEXT-VERSION-INCREMENT-MINOR': 'false',
  'INPUT_NEXT-VERSION-INCREMENT-PATCH': 'false',
  'INPUT_NEXT-VERSION-INCREMENT-PRERELEASE': 'false',
  'INPUT_RELEASE-VERSION-BUILD-METADATA-PATTERN': 'build.{date}.{hash}',
  'INPUT_NEXT-VERSION-CUT-PRERELEASE': 'false',
  'INPUT_NEXT-VERSION-CUT-BUILD-METADATA': 'true',
  'INPUT_NEXT-VERSION-PUT-BUILD-METADATA': 'false',
  'INPUT_DATA-EXTRACT': 'false',
};

function setEnv(inputs = {}) {
  Object.keys(MINIMAL_CORRECT_INPUTS)
    .forEach((k) => {
      process.env[k] = MINIMAL_CORRECT_INPUTS[k];
    });
  Object.keys(inputs)
    .forEach((k) => {
      process.env[k] = inputs[k];
    });
}

test('Test correct properties input, variable version source', () => {
  setEnv();
  expect(new app.Properties())
    .toMatchObject({ version: '1.0.0' });
});

test('Test properties fail if version-source is \'file\' and no file specified', () => {
  const inputs = {
    'INPUT_VERSION-SOURCE': 'file',
  };
  setEnv(inputs);
  const p = () => new app.Properties();
  expect(p)
    .toThrowError('Input required and not supplied: version-file');
});

test(
  'Test properties fail if version-source is \'file\' and no \'extraction-pattern\' specified',
  () => {
    const inputs = {
      'INPUT_VERSION-SOURCE': 'file',
      'INPUT_VERSION-FILE': 'tests/resources/version.txt',
    };
    setEnv(inputs);

    const p = () => new app.Properties();
    expect(p)
      .toThrowError('Input required and not supplied: version-file-extraction-pattern');
  },
);

test('Test properties fail if version-source is \'variable\' and no \'version\' specified', () => {
  const inputs = {
    INPUT_VERSION: '',
  };
  setEnv(inputs);

  const p = () => new app.Properties();
  expect(p)
    .toThrowError('Input required and not supplied: version');
});

// Metadata generation

const METADATA_DEFAULT_MODEL = {
  date: new Date(2020, 2, 2, 17, 33, 3),
  hash: '622161f9e2993288c026f9c8eb71a0659ed933ee',
};

const METADATA_TEST_CASES = [
  [
    'build.{date}.{hash}', 'build.2017-03-02.622161f9',
    {
      ...METADATA_DEFAULT_MODEL,
      date: new Date(2017, 2, 2, 17, 33, 3),
    }],
  ['build.{date[YYYY-MM-dd-HH]}.{hash}', 'build.2020-03-Mo-17.622161f9', METADATA_DEFAULT_MODEL],
  [
    'build.{date[YYYY.MM]}.{hash[0,10]}', 'build.2020.08.7c8146ed9b',
    {
      date: new Date(2020, 7, 2, 17, 33, 3),
      hash: '7c8146ed9b99476e4e53e97f3ebd9a4b24a69c3d',
    }],
  [
    'build.{date[ YYYY-MM-DD ]}.{hash[ 0, 10 ]}',
    'build.2020-03-02.622161f9e2',
    METADATA_DEFAULT_MODEL],
  [
    '{date}-{hash}-something', '2020-03-02-7c8146ed-something',
    {
      ...METADATA_DEFAULT_MODEL,
      hash: '7c8146ed9b99476e4e53e97f3ebd9a4b24a69c3d',
    }],
  ['build-{date}-{hash}', 'build-2020-03-02-622161f9', METADATA_DEFAULT_MODEL],
  ['build.{date}.hash.{hash}', 'build.2020-03-02.hash.622161f9', METADATA_DEFAULT_MODEL],
  ['{date}.{hash[0,6]}', '2020-03-02.622161', METADATA_DEFAULT_MODEL],
  ['build.2342234.', 'build.2342234.', METADATA_DEFAULT_MODEL],
  [
    '{date}.{hash[0,10000000000000000000]}',
    '2020-03-02.622161f9e2993288c026f9c8eb71a0659ed933ee',
    METADATA_DEFAULT_MODEL],
  ['{date}.{hash[-1000,6]}', '2020-03-02.622161', METADATA_DEFAULT_MODEL],
  [
    '{date}.{hash[10000000000000000000, 0]}',
    '2020-03-02.622161f9e2993288c026f9c8eb71a0659ed933ee',
    METADATA_DEFAULT_MODEL],
];

describe('Test metadata generation with different patterns', () => {
  each(METADATA_TEST_CASES)
    .it('When pattern is \'%s\'', (pattern, expected, model) => {
      const result = app.generateMetadata(pattern, model);
      expect(result)
        .toBe(expected);
    });
});

// RELEASE_VERSION generation

const DATE = new Date(Date.now());
const PAST_DATE = new Date(2017, 2, 4, 17, 33, 53);
const DATE_FORMAT = new Intl.NumberFormat('en-US', { minimumIntegerDigits: 2 });

const CURRENT_VERSION = new app.Version({
  input: '1.2.3-BETA-7-SNAPSHOT+build.2017-02-03.3e1f4d',
  major: '1',
  minor: '2',
  patch: '3',
  prerelease: 'BETA-7-SNAPSHOT',
  buildmetadata: 'build.2017-02-03.3e1f4d',
});

const INCORRECT_SNAPSHOT_VERSION = new app.Version({
  input: '1.2.3-BETA-SNAPSHOT-7+build.2017-02-03.3e1f4d',
  major: '1',
  minor: '2',
  patch: '3',
  prerelease: 'BETA-SNAPSHOT-7',
  buildmetadata: 'build.2017-02-03.3e1f4d',
});

const RELEASE_VERSION_TEST_CASES = [
  [{}, CURRENT_VERSION, '1.2.3-BETA-7'],
  [
    { 'INPUT_RELEASE-VERSION-CUT-BUILD-METADATA': 'false' },
    CURRENT_VERSION,
    '1.2.3-BETA-7+build.2017-02-03.3e1f4d'],
  [
    {
      'INPUT_RELEASE-VERSION-CUT-SNAPSHOT': 'false',
      'INPUT_RELEASE-VERSION-CUT-BUILD-METADATA': 'false',
    }, CURRENT_VERSION, '1.2.3-BETA-7-SNAPSHOT+build.2017-02-03.3e1f4d'],
  [{ 'INPUT_RELEASE-VERSION-CUT-SNAPSHOT': 'false' }, CURRENT_VERSION, '1.2.3-BETA-7-SNAPSHOT'],
  [{}, INCORRECT_SNAPSHOT_VERSION, '1.2.3-BETA-SNAPSHOT-7'],
  [
    {
      'INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA': 'true',
    },
    CURRENT_VERSION,
    `1.2.3-BETA-7+build.${DATE.getUTCFullYear()}-${DATE_FORMAT.format(
      DATE.getUTCMonth() + 1,
    )
    }-${DATE_FORMAT.format(DATE.getUTCDate())}.8278cdaf`],
  [
    {
      'INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA': 'true',
      'INPUT_RELEASE-VERSION-BUILD-METADATA-DATETIME': PAST_DATE.toISOString(),
    },
    CURRENT_VERSION,
    `1.2.3-BETA-7+build.${PAST_DATE.getUTCFullYear()}-${DATE_FORMAT.format(
      PAST_DATE.getUTCMonth() + 1,
    )}-${DATE_FORMAT.format(PAST_DATE.getUTCDate())}.8278cdaf`],
  [
    {
      'INPUT_RELEASE-VERSION-GENERATE-BUILD-METADATA': 'true',
      'INPUT_RELEASE-VERSION-BUILD-METADATA-DATETIME': `${PAST_DATE.getFullYear()}-${PAST_DATE.getMonth()
      + 1}-${PAST_DATE.getDate()}`,
    },
    CURRENT_VERSION,
    `1.2.3-BETA-7+build.${PAST_DATE.getUTCFullYear()}-${DATE_FORMAT.format(
      PAST_DATE.getUTCMonth() + 1,
    )}-${DATE_FORMAT.format(PAST_DATE.getUTCDate())}.8278cdaf`],
  [{ 'INPUT_RELEASE-VERSION-CUT-PRERELEASE': 'true' }, CURRENT_VERSION, '1.2.3'],
  [
    {
      'INPUT_RELEASE-VERSION-CUT-PRERELEASE': 'true',
      'INPUT_RELEASE-VERSION-CUT-BUILD-METADATA': 'false',
    }, CURRENT_VERSION, '1.2.3+build.2017-02-03.3e1f4d'],
];

describe('Test release version generation with different properties', () => {
  each(RELEASE_VERSION_TEST_CASES)
    .it(
      'When inputs are \'%s\'; and version is: \'%s\'; expected is \'%s\'',
      (inputs, currentVersion, expected) => {
        setEnv(inputs);

        const result = app.generateReleaseVersion(currentVersion, new app.Properties())
          .toString();
        expect(result)
          .toBe(expected);
      },
    );
});

// NEXT_VERSION generation

const PRERELEASE_INCREMENT_TEST_CASES = [
  [new app.Version(CURRENT_VERSION), '1.2.3-BETA-8-SNAPSHOT+build.2017-02-03.3e1f4d'],
  [new app.Version(INCORRECT_SNAPSHOT_VERSION), '1.2.3-BETA-SNAPSHOT-7+build.2017-02-03.3e1f4d'],
  [
    new app.Version({
      ...CURRENT_VERSION,
      prerelease: 'TESTNG7-BETA-7-SNAPSHOT',
    }), '1.2.3-TESTNG7-BETA-8-SNAPSHOT+build.2017-02-03.3e1f4d'],
  [
    new app.Version({
      ...CURRENT_VERSION,
      prerelease: 'TESTNG6-RC1',
    }),
    '1.2.3-TESTNG6-RC2+build.2017-02-03.3e1f4d'],
  [
    new app.Version({
      ...CURRENT_VERSION,
      prerelease: 'TESTNG6-RC-1',
    }),
    '1.2.3-TESTNG6-RC-2+build.2017-02-03.3e1f4d'],
  [
    new app.Version({
      ...CURRENT_VERSION,
      prerelease: 'ALPHA-SNAPSHOT',
    }), '1.2.3-ALPHA-SNAPSHOT+build.2017-02-03.3e1f4d'],
];

describe('Test prerelease increments', () => {
  beforeAll(() => {
    setEnv();
  });
  each(PRERELEASE_INCREMENT_TEST_CASES)
    .it('When version is: \'%s\'; result should be: \'%s\'', (input, expected) => {
      input.incrementPrerelease();
      expect(input.toString())
        .toBe(expected);
    });
});

const RELEASE_VERSION = new app.Version({
  input: '1.2.3-BETA-7',
  major: '1',
  minor: '2',
  patch: '3',
  prerelease: 'BETA-7',
  buildmetadata: 'build.2017-02-04.5e2079',
});

const NEXT_VERSION_TEST_CASES = [
  [{}, CURRENT_VERSION, RELEASE_VERSION, '1.2.3-BETA-8-SNAPSHOT'],
  [
    { 'INPUT_NEXT-VERSION-PUT-BUILD-METADATA': 'true' },
    CURRENT_VERSION,
    RELEASE_VERSION,
    '1.2.3-BETA-8-SNAPSHOT+build.2017-02-04.5e2079'],
  [
    { 'INPUT_NEXT-VERSION-INCREMENT-PATCH': 'true' },
    CURRENT_VERSION,
    RELEASE_VERSION,
    '1.2.4-BETA-1-SNAPSHOT'],
  [
    { 'INPUT_NEXT-VERSION-INCREMENT-MINOR': 'true' },
    CURRENT_VERSION,
    RELEASE_VERSION,
    '1.3.0-BETA-1-SNAPSHOT'],
  [
    { 'INPUT_NEXT-VERSION-INCREMENT-MAJOR': 'true' },
    CURRENT_VERSION,
    RELEASE_VERSION,
    '2.0.0-BETA-1-SNAPSHOT'],
  [
    { 'INPUT_NEXT-VERSION-INCREMENT-PRERELEASE': 'true' },
    new app.Version(
      {
        ...CURRENT_VERSION,
        prerelease: 'SNAPSHOT',
      },
    ), RELEASE_VERSION, '1.2.3-SNAPSHOT'],
  [
    {},
    new app.Version(
      {
        ...CURRENT_VERSION,
        prerelease: 'SNAPSHOT',
      },
    ), RELEASE_VERSION, '1.2.4-SNAPSHOT'],
  [
    {
      'INPUT_NEXT-VERSION-INCREMENT-MAJOR': 'true',
      'INPUT_NEXT-VERSION-INCREMENT-PRERELEASE': 'true',
    }, CURRENT_VERSION, RELEASE_VERSION, '2.0.0-BETA-1-SNAPSHOT'],
  [{ 'INPUT_NEXT-VERSION-CUT-PRERELEASE': 'true' }, CURRENT_VERSION, RELEASE_VERSION, '1.2.4'],
  [
    {
      'INPUT_NEXT-VERSION-CUT-PRERELEASE': 'true',
      'INPUT_NEXT-VERSION-INCREMENT-PATCH': 'true',
    }, CURRENT_VERSION, RELEASE_VERSION, '1.2.4'],
];
describe('Test next version generation with different properties', () => {
  each(NEXT_VERSION_TEST_CASES)
    .it(
      'When inputs are \'%s\'; and current version is: \'%s\'; and release version is: \'%s\'; expected is \'%s\'',
      (inputs, currentVersion, releaseVersion, expected) => {
        setEnv(inputs);

        const result = app.generateNextVersion(
          currentVersion,
          releaseVersion,
          new app.Properties(),
        )
          .toString();
        expect(result)
          .toBe(expected);
      },
    );
});

const REGEX = XRegExp('(?<=variable.name=).+', 'i');
const TWO_REGEXES = [REGEX, XRegExp('"version":\\s*"([^"]+)"')];

const REGEX_STR_CASES = [
  ['/(?<=variable.name=).+/i', [REGEX]],
  ['/(?<=variable.name=).+/i;/"version":\\s*"([^"]+)"/', TWO_REGEXES],
  ['/(?<=variable.name=).+/i; /"version":\\s*"([^"]+)"/', TWO_REGEXES],
  ['/(?<=variable.name=).+/i;                   /"version":\\s*"([^"]+)"/', TWO_REGEXES],
];

describe('Test RegEx string conversion', () => {
  each(REGEX_STR_CASES)
    .it('When RegEx inputs are \'%s\'', (inputs, expected) => {
      setEnv();

      const result = app.toRegExes(inputs);
      expect(result)
        .toStrictEqual(expected);
    });
});

const ERROR_REGEX_CASES = [
  '/(?<=variable.name=/+).+/dqi',
  '/(?<=variable.name=).+/i; /(?<=variable.name=/+).+/dqi',
  '/(?<=variable.name=).+/i; /(?<=variable.name=/+).+',
  '(?<=variable.name=/+).+/i',
];

describe('Test RegEx string conversion error', () => {
  each(ERROR_REGEX_CASES)
    .it('When RegEx input is \'%s\'', (inputs) => {
      setEnv();

      expect(() => app.toRegExes(inputs))
        .toThrowError('Unable to parse RegEx');
    });
});

const VARIABLE_NAMES_CONVERSION_CASES = [
  ['description_var', 'DESCRIPTION_VAR'],
  ['description-var', 'DESCRIPTION_VAR'],
  ['description var', 'DESCRIPTION_VAR'],
  ['description            var', 'DESCRIPTION_VAR'],
  ['description-----var', 'DESCRIPTION_VAR'],
  ['^description var$', 'DESCRIPTION_VAR'],
  ['   description    var', '_DESCRIPTION_VAR'],
  ['   description    var    ', '_DESCRIPTION_VAR_'],
  [null, null],
  ['description_var_43', 'DESCRIPTION_VAR_43'],
  ['', ''],
];

describe('Test variable name string conversion', () => {
  each(VARIABLE_NAMES_CONVERSION_CASES)
    .it('When variable name input is \'%s\'', (inputs, expected) => {
      setEnv();

      const result = app.toVariableName(inputs);
      expect(result)
        .toBe(expected);
    });
});

const DATA_EXTRACTION_CASES = [
  [
    'tests/resources/simple_gradle.properties', '/(\\w+)\\s*=\\s*(.+)/gi', null,
    [
      {
        VERSION: '5.0.3-SNAPSHOT',
        DESCRIPTION: 'TestNG Agent',
      },
    ],
  ],
  [
    'tests/resources/simple_gradle.properties', '/\\w+\\s*=\\s*(.+)/gi', 'test-name',
    [
      {
        TEST_NAME: '5.0.3-SNAPSHOT',
        TEST_NAME_1: 'TestNG Agent',
      },
    ],
  ],
  [
    'tests/resources/simple_gradle.properties', '/(?<=version=).+/gi', 'test-name',
    [
      {
        TEST_NAME: '5.0.3-SNAPSHOT',
      },
    ],
  ],
  [
    'tests/resources/simple_gradle.properties; tests/resources/more_complex_gradle.properties',
    '/(?<=version=).+/',
    'test-name',
    [
      {
        TEST_NAME: '5.0.3-SNAPSHOT',
      },
      {
        TEST_NAME_1: '5.0.0-BETA-16-SNAPSHOT',
      },
    ],
  ],
  [
    'tests/resources/simple_gradle.properties; tests/resources/more_complex_gradle.properties',
    '/\\w+\\s*=\\s*(.+)/gi',
    null,
    [{}, {}]],
  [
    'tests/resources/more_complex_gradle.properties',
    '/(version)\\s*=\\s*(.+)/g; /(description)\\s*=\\s*(.+)/gi',
    null,
    [
      {
        VERSION: '5.0.0-BETA-16-SNAPSHOT',
        DESCRIPTION: 'JUnit5 Agent',
      }]],
];

describe('Test data extraction cases', () => {
  each(DATA_EXTRACTION_CASES)
    .it(
      'When file name input is \'%s\', pattern input is \'%s\', variable name is \'%s\'',
      async (files, patterns, name, expected) => {
        setEnv();
        process.env['INPUT_DATA-EXTRACT'] = 'true';
        process.env['INPUT_DATA-EXTRACT-PATHS'] = files;
        process.env['INPUT_DATA-EXTRACT-PATTERNS'] = patterns;
        if (name == null) {
          delete process.env['INPUT_DATA-EXTRACT-NAME'];
        } else {
          process.env['INPUT_DATA-EXTRACT-NAME'] = name;
        }

        const result = await app.extractData(new app.Properties());
        expect(result)
          .toEqual(expected);
      },
    );
});
