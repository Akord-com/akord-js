module.exports = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  bail: true,

  moduleFileExtensions: ['ts', 'js', 'node'],

  testPathIgnorePatterns: [
    "/.yalc/",
    "/data/",
    "/_helpers",
  ],

  testEnvironment: 'node',

  "transformIgnorePatterns": [
    "<rootDir>/node_modules/(?!@assemblyscript/.*)"
  ],


  transform: {
    '^.+\\.(ts|js)$': 'ts-jest'
  }
};