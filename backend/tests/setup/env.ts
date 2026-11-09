/**
 * Variables d'environnement de test (aucune n'est un vrai secret).
 * Chargées avant les modules de l'application.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-not-for-production";
process.env.API_VERSION = "v1";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/souverainrecrut_test";
