/**
 * Configuration Jest du backend SouverainRecrut.
 *
 * - Tests écrits en TypeScript (ts-jest).
 * - Prisma est simulé (mock) : aucune base PostgreSQL n'est nécessaire.
 * - Rapport de couverture : coverage/lcov.info (exploité par la pipeline et SonarQube).
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],

  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },

  setupFiles: ["<rootDir>/tests/setup/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/mocks.ts"],

  clearMocks: true,

  // ---------- Couverture ----------
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",
    "!src/docs/**",
    "!src/types/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
