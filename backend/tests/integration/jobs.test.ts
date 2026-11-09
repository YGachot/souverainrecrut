import request from "supertest";

import app from "../../src/app";
import { asAdmin, asRecruiter, RECRUITER_ID } from "../helpers/auth";
import { buildJob } from "../helpers/fixtures";
import { prismaMock } from "../helpers/prisma";

const validJob = {
  title: "Développeur Backend Node.js",
  description: "Développement et maintenance de l'API SouverainRecrut.",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: RECRUITER_ID,
};

describe("Offres d'emploi - /v1/jobs", () => {
  it("GET / retourne la liste paginée", async () => {
    prismaMock.job.findMany.mockResolvedValue([buildJob()]);
    prismaMock.job.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/v1/jobs")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it("GET /:id retourne l'offre", async () => {
    prismaMock.job.findUnique.mockResolvedValue(buildJob());

    const res = await request(app)
      .get("/v1/jobs/job-1")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(validJob.title);
  });

  it("GET /:id retourne 404 si l'offre n'existe pas", async () => {
    prismaMock.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/jobs/inconnue")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Offre introuvable.");
  });

  it("POST / crée une offre (201)", async () => {
    prismaMock.job.create.mockResolvedValue(buildJob());

    const res = await request(app)
      .post("/v1/jobs")
      .set("Authorization", asRecruiter())
      .send(validJob);

    expect(res.status).toBe(201);
    expect(prismaMock.job.create).toHaveBeenCalledWith({ data: validJob });
  });

  it("POST / retourne 400 si des champs obligatoires manquent", async () => {
    const res = await request(app)
      .post("/v1/jobs")
      .set("Authorization", asRecruiter())
      .send({ title: "Dev" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(["description", "location", "company", "recruiterId"])
    );
  });

  it("PUT /:id met à jour une offre", async () => {
    prismaMock.job.findUnique.mockResolvedValue(buildJob());
    prismaMock.job.update.mockResolvedValue(buildJob({ location: "Paris" }));

    const res = await request(app)
      .put("/v1/jobs/job-1")
      .set("Authorization", asRecruiter())
      .send({ location: "Paris" });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe("Paris");
  });

  it("PUT /:id retourne 404 si l'offre n'existe pas", async () => {
    prismaMock.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/v1/jobs/inconnue")
      .set("Authorization", asRecruiter())
      .send({ location: "Paris" });

    expect(res.status).toBe(404);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });

  it("DELETE /:id retourne 404 si l'offre n'existe pas (ADMIN)", async () => {
    prismaMock.job.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/v1/jobs/inconnue")
      .set("Authorization", asAdmin());

    expect(res.status).toBe(404);
  });
});
