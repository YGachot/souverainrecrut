import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";

import app from "../../src/app";
import { asRecruiter, RECRUITER_ID } from "../helpers/auth";
import { buildUser } from "../helpers/fixtures";
import { prismaMock } from "../helpers/prisma";

const PASSWORD = "MotDePasse123!";

describe("Authentification - /v1/auth", () => {
  let hashedPassword: string;

  beforeAll(async () => {
    // Coût faible (4) : suffisant pour les tests et rapide
    hashedPassword = await bcrypt.hash(PASSWORD, 4);
  });

  describe("POST /v1/auth/login", () => {
    it("retourne 200, un JWT valide et l'utilisateur sans mot de passe", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        buildUser({ password: hashedPassword })
      );

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "awa.camara@souverainrecrut.test", password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe("awa.camara@souverainrecrut.test");
      expect(res.body.data.user).not.toHaveProperty("password");

      const payload = jwt.verify(
        res.body.data.token,
        process.env.JWT_SECRET as string
      ) as jwt.JwtPayload;
      expect(payload.id).toBe(RECRUITER_ID);
      expect(payload.role).toBe("RECRUITER");
    });

    it("retourne 401 si l'email est inconnu", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "inconnu@example.test", password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
    });

    it("retourne 401 si le mot de passe est incorrect (même message, pas d'énumération)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        buildUser({ password: hashedPassword })
      );

      const res = await request(app)
        .post("/v1/auth/login")
        .send({ email: "awa.camara@souverainrecrut.test", password: "mauvais" });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
    });
  });

  describe("GET /v1/auth/me", () => {
    it("retourne 401 sans en-tête Authorization", async () => {
      const res = await request(app).get("/v1/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Authentification requise.");
    });

    it("retourne 401 si le schéma n'est pas Bearer", async () => {
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", "Basic abc123");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token invalide.");
    });

    it("retourne 401 si le token est absent après Bearer", async () => {
      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", "Bearer");

      expect(res.status).toBe(401);
    });

    it("retourne 401 si le token est signé avec un autre secret", async () => {
      const forged = jwt.sign({ id: "x", role: "ADMIN" }, "autre-secret");

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Token invalide ou expiré.");
    });

    it("retourne 401 si le token est expiré", async () => {
      const expired = jwt.sign(
        { id: RECRUITER_ID, role: "RECRUITER" },
        process.env.JWT_SECRET as string,
        { expiresIn: -10 }
      );

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${expired}`);

      expect(res.status).toBe(401);
    });

    it("retourne 200 et le profil de l'utilisateur connecté", async () => {
      const { password: _password, ...profile } = buildUser();
      prismaMock.user.findUnique.mockResolvedValue(profile as never);

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", asRecruiter());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(RECRUITER_ID);
      expect(res.body.data).not.toHaveProperty("password");
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: RECRUITER_ID } })
      );
    });

    it("retourne 404 si l'utilisateur du token n'existe plus", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", asRecruiter());

      expect(res.status).toBe(404);
    });
  });
});
