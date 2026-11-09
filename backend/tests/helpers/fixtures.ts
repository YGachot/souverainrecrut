import {
  Application,
  ApplicationStatus,
  Candidate,
  Job,
  Role,
  User,
} from "@prisma/client";

import { RECRUITER_ID } from "./auth";

const NOW = new Date("2026-11-09T10:00:00.000Z");

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: RECRUITER_ID,
  firstName: "Awa",
  lastName: "Camara",
  email: "awa.camara@souverainrecrut.test",
  password: "$2b$04$hashNotUsedInThisFixture",
  role: Role.RECRUITER,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const buildCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "cand-1",
  fullName: "Mamadou Diallo",
  email: "mamadou.diallo@example.test",
  phone: "+224620000000",
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const buildJob = (overrides: Partial<Job> = {}): Job => ({
  id: "job-1",
  title: "Développeur Backend Node.js",
  description: "Développement et maintenance de l'API SouverainRecrut.",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: RECRUITER_ID,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

export const buildApplication = (
  overrides: Partial<Application> = {}
): Application => ({
  id: "app-1",
  candidateId: "cand-1",
  jobId: "job-1",
  status: ApplicationStatus.PENDING,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});
