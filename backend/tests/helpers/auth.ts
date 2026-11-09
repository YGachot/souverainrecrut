import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export const ADMIN_ID = "user-admin-1";
export const RECRUITER_ID = "user-recruiter-1";

/**
 * Génère un JWT valide signé avec le secret de test.
 */
export function tokenFor(role: Role, id = role === Role.ADMIN ? ADMIN_ID : RECRUITER_ID): string {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}

/**
 * En-tête Authorization prêt à l'emploi pour Supertest.
 */
export function bearer(role: Role): string {
  return `Bearer ${tokenFor(role)}`;
}

export const asAdmin = (): string => bearer(Role.ADMIN);
export const asRecruiter = (): string => bearer(Role.RECRUITER);
