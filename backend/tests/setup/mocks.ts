import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "jest-mock-extended";

import { prismaMock } from "../helpers/prisma";

/**
 * Remplace le singleton Prisma (src/config/prisma.ts) par un mock :
 * les tests n'ont besoin d'aucune base de données.
 */
jest.mock("../../src/config/prisma", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});
