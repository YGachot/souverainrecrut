import { ApplicationStatus } from "@prisma/client";
import request from "supertest";

import app from "../../src/app";
import { asAdmin, asRecruiter } from "../helpers/auth";
import { buildApplication } from "../helpers/fixtures";
import { prismaMock } from "../helpers/prisma";

describe("Candidatures - /v1/applications", () => {
  it("GET / retourne la liste paginée avec candidat et offre", async () => {
    prismaMock.application.findMany.mockResolvedValue([buildApplication()]);
    prismaMock.application.count.mockResolvedValue(1);

    const res = await request(app)
      .get("/v1/applications")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(prismaMock.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { candidate: true, job: true },
      })
    );
  });

  it("GET /:id retourne la candidature", async () => {
    prismaMock.application.findUnique.mockResolvedValue(buildApplication());

    const res = await request(app)
      .get("/v1/applications/app-1")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("GET /:id retourne 404 si la candidature n'existe pas", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/applications/inconnue")
      .set("Authorization", asRecruiter());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Candidature introuvable.");
  });

  it("POST / crée une candidature (201)", async () => {
    prismaMock.application.create.mockResolvedValue(buildApplication());

    const res = await request(app)
      .post("/v1/applications")
      .set("Authorization", asRecruiter())
      .send({ candidateId: "cand-1", jobId: "job-1" });

    expect(res.status).toBe(201);
    expect(prismaMock.application.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { candidateId: "cand-1", jobId: "job-1" },
      })
    );
  });

  it("POST / retourne 400 si candidat ou offre manquant", async () => {
    const res = await request(app)
      .post("/v1/applications")
      .set("Authorization", asRecruiter())
      .send({ candidateId: "" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["candidateId", "jobId"]));
  });

  it("POST / retourne 400 si le statut est invalide", async () => {
    const res = await request(app)
      .post("/v1/applications")
      .set("Authorization", asRecruiter())
      .send({ candidateId: "cand-1", jobId: "job-1", status: "HIRED" });

    expect(res.status).toBe(400);
  });

  it.each([
    ApplicationStatus.REVIEWED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
  ])("PUT /:id change le statut en %s", async (status) => {
    prismaMock.application.findUnique.mockResolvedValue(buildApplication());
    prismaMock.application.update.mockResolvedValue(buildApplication({ status }));

    const res = await request(app)
      .put("/v1/applications/app-1")
      .set("Authorization", asRecruiter())
      .send({ status });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(status);
  });

  it("PUT /:id retourne 400 sans statut", async () => {
    const res = await request(app)
      .put("/v1/applications/app-1")
      .set("Authorization", asRecruiter())
      .send({});

    expect(res.status).toBe(400);
  });

  it("PUT /:id retourne 404 si la candidature n'existe pas", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/v1/applications/inconnue")
      .set("Authorization", asRecruiter())
      .send({ status: ApplicationStatus.ACCEPTED });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id retourne 404 si la candidature n'existe pas (ADMIN)", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete("/v1/applications/inconnue")
      .set("Authorization", asAdmin());

    expect(res.status).toBe(404);
  });
});
