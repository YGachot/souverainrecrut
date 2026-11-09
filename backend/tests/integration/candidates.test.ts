import request from "supertest";

import app from "../../src/app";
import { asAdmin, asRecruiter } from "../helpers/auth";
import { buildCandidate } from "../helpers/fixtures";
import { prismaMock } from "../helpers/prisma";

describe("Candidats - /v1/candidates", () => {
  describe("GET /", () => {
    it("retourne la liste paginée", async () => {
      prismaMock.candidate.findMany.mockResolvedValue([
        buildCandidate(),
        buildCandidate({ id: "cand-2", email: "b@example.test" }),
      ]);
      prismaMock.candidate.count.mockResolvedValue(12);

      const res = await request(app)
        .get("/v1/candidates?page=2&limit=5")
        .set("Authorization", asRecruiter());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      });
      expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 })
      );
    });

    it("applique la pagination par défaut (page 1, 10 éléments)", async () => {
      prismaMock.candidate.findMany.mockResolvedValue([]);
      prismaMock.candidate.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/v1/candidates")
        .set("Authorization", asRecruiter());

      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });

  describe("GET /:id", () => {
    it("retourne le candidat", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(buildCandidate());

      const res = await request(app)
        .get("/v1/candidates/cand-1")
        .set("Authorization", asRecruiter());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("cand-1");
    });

    it("retourne 404 si le candidat n'existe pas", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/candidates/inconnu")
        .set("Authorization", asRecruiter());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Candidat introuvable.");
    });
  });

  describe("POST /", () => {
    it("crée un candidat (201) et normalise l'email en minuscules", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);
      prismaMock.candidate.create.mockResolvedValue(buildCandidate());

      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", asRecruiter())
        .send({
          fullName: "  Mamadou Diallo  ",
          email: "Mamadou.Diallo@Example.TEST",
          phone: "+224620000000",
        });

      expect(res.status).toBe(201);
      expect(prismaMock.candidate.create).toHaveBeenCalledWith({
        data: {
          fullName: "Mamadou Diallo",
          email: "mamadou.diallo@example.test",
          phone: "+224620000000",
        },
      });
    });

    it("retourne 409 si l'email existe déjà", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(buildCandidate());

      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", asRecruiter())
        .send({ fullName: "Mamadou Diallo", email: "mamadou.diallo@example.test" });

      expect(res.status).toBe(409);
      expect(prismaMock.candidate.create).not.toHaveBeenCalled();
    });

    it("retourne 400 avec le détail des champs invalides", async () => {
      const res = await request(app)
        .post("/v1/candidates")
        .set("Authorization", asRecruiter())
        .send({ fullName: "Al", email: "pas-un-email", phone: "123" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Erreur de validation.");
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["fullName", "email", "phone"]));
      expect(prismaMock.candidate.create).not.toHaveBeenCalled();
    });
  });

  describe("PUT /:id", () => {
    it("met à jour un candidat existant (mise à jour partielle)", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(buildCandidate());
      prismaMock.candidate.update.mockResolvedValue(
        buildCandidate({ phone: "+33600000000" })
      );

      const res = await request(app)
        .put("/v1/candidates/cand-1")
        .set("Authorization", asRecruiter())
        .send({ phone: "+33600000000" });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe("+33600000000");
      expect(prismaMock.candidate.update).toHaveBeenCalledWith({
        where: { id: "cand-1" },
        data: { phone: "+33600000000" },
      });
    });

    it("retourne 404 si le candidat n'existe pas", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put("/v1/candidates/inconnu")
        .set("Authorization", asRecruiter())
        .send({ phone: "+33600000000" });

      expect(res.status).toBe(404);
      expect(prismaMock.candidate.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:id", () => {
    it("retourne 404 si le candidat n'existe pas (ADMIN)", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete("/v1/candidates/inconnu")
        .set("Authorization", asAdmin());

      expect(res.status).toBe(404);
      expect(prismaMock.candidate.delete).not.toHaveBeenCalled();
    });
  });
});
