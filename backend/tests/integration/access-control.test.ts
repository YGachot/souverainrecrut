import { Role } from "@prisma/client";
import request from "supertest";

import app from "../../src/app";
import { asAdmin, asRecruiter, bearer } from "../helpers/auth";
import {
  buildApplication,
  buildCandidate,
  buildJob,
} from "../helpers/fixtures";
import { prismaMock } from "../helpers/prisma";

/**
 * Contrôle d'accès (RBAC) sur les ressources de l'API.
 *
 * Ressource      | Lecture / création / modif | Suppression
 * candidates     | ADMIN, RECRUITER           | ADMIN
 * jobs           | ADMIN, RECRUITER           | ADMIN
 * applications   | ADMIN, RECRUITER           | ADMIN
 */
describe("Contrôle d'accès (RBAC)", () => {
  const protectedRoutes: Array<[string, string]> = [
    ["get", "/v1/candidates"],
    ["get", "/v1/candidates/cand-1"],
    ["post", "/v1/candidates"],
    ["put", "/v1/candidates/cand-1"],
    ["delete", "/v1/candidates/cand-1"],
    ["get", "/v1/jobs"],
    ["post", "/v1/jobs"],
    ["delete", "/v1/jobs/job-1"],
    ["get", "/v1/applications"],
    ["post", "/v1/applications"],
    ["delete", "/v1/applications/app-1"],
  ];

  describe("sans token -> 401", () => {
    it.each(protectedRoutes)("%s %s", async (method, url) => {
      const res = await (request(app) as any)[method](url).send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("RECRUITER : suppression réservée à ADMIN -> 403", () => {
    const adminOnly: Array<[string, string]> = [
      ["delete", "/v1/candidates/cand-1"],
      ["delete", "/v1/jobs/job-1"],
      ["delete", "/v1/applications/app-1"],
    ];

    it.each(adminOnly)("%s %s", async (method, url) => {
      const res = await (request(app) as any)[method](url)
        .set("Authorization", asRecruiter())
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe(
        "Accès refusé. Permissions insuffisantes."
      );
    });
  });

  describe("ADMIN : suppression autorisée", () => {
    it("DELETE /v1/candidates/:id -> 200", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(buildCandidate());
      prismaMock.candidate.delete.mockResolvedValue(buildCandidate());

      const res = await request(app)
        .delete("/v1/candidates/cand-1")
        .set("Authorization", asAdmin());

      expect(res.status).toBe(200);
    });

    it("DELETE /v1/jobs/:id -> 200", async () => {
      prismaMock.job.findUnique.mockResolvedValue(buildJob());
      prismaMock.job.delete.mockResolvedValue(buildJob());

      const res = await request(app)
        .delete("/v1/jobs/job-1")
        .set("Authorization", asAdmin());

      expect(res.status).toBe(200);
    });

    it("DELETE /v1/applications/:id -> 200", async () => {
      prismaMock.application.findUnique.mockResolvedValue(buildApplication());
      prismaMock.application.delete.mockResolvedValue(buildApplication());

      const res = await request(app)
        .delete("/v1/applications/app-1")
        .set("Authorization", asAdmin());

      expect(res.status).toBe(200);
    });
  });

  it("RECRUITER peut lister les candidats (200)", async () => {
    prismaMock.candidate.findMany.mockResolvedValue([]);
    prismaMock.candidate.count.mockResolvedValue(0);

    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(200);
  });

  it("un rôle inconnu dans le token est refusé (403)", async () => {
    const res = await request(app)
      .get("/v1/candidates")
      .set("Authorization", bearer("VISITOR" as Role));

    expect(res.status).toBe(403);
  });
});
