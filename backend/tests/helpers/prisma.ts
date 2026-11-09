import { PrismaClient } from "@prisma/client";
import { DeepMockProxy } from "jest-mock-extended";

import { prisma } from "../../src/config/prisma";

/**
 * Accès typé au mock Prisma installé dans tests/setup/mocks.ts.
 */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
