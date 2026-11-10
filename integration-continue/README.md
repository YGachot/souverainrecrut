# Intégration continue - SouverainRecrut Backend

Chaque exécution du pipeline Jenkins teste le Backend, contrôle sa qualité avec SonarQube, construit l'image Docker, l'analyse avec Trivy et la publie sur Docker Hub avec un tag traçable. Cette image est ensuite déployée sans être reconstruite (voir `deploiement/`).

## Emplacement des fichiers

Les fichiers d'intégration continue restent à l'endroit où les outils les attendent. Ce dossier regroupe la documentation et les rapports.

| Élément | Emplacement | Rôle |
|---|---|---|
| Pipeline Jenkins | `Jenkinsfile` (racine du dépôt) | 8 étapes, de la récupération du code à la publication |
| Image Backend | `backend/Dockerfile` + `backend/.dockerignore` | build multi-stage, Node 22.23.4 Alpine, port 4000 |
| Image Jenkins | `jenkins/Dockerfile` | Jenkins LTS + client Docker + Node 22 + plugins nécessaires |
| Configuration SonarQube | `backend/sonar-project.properties` | clé du projet, sources, tests, rapport de couverture, exclusions |
| Tests | `backend/tests/`, `backend/jest.config.js` | tests d'intégration de l'API (Jest + Supertest, Prisma simulé) |
| Résultats SonarQube | `integration-continue/sonar/` | Quality Gate, mesures, problèmes ouverts |
| Rapports | `integration-continue/reports/` | tests, couverture, Trivy |

## Pipeline Jenkins

| # | Stage | Action | En cas d'échec |
|---|---|---|---|
| 1 | Checkout Dev | récupère la branche `Dev`, calcule le tag `version-commit` (ex. `1.0.0-4670db8`) | arrêt |
| 2 | Installation des dépendances | `npm ci` | arrêt |
| 3 | Génération Prisma | `npx prisma generate` | arrêt |
| 4 | Tests | `npm run test:coverage` : tests et rapport `coverage/lcov.info` | arrêt |
| 5 | Analyse SonarQube + Quality Gate | `@sonar/scan` avec `sonar.qualitygate.wait=true` | arrêt si Quality Gate en échec |
| 6 | Build image Docker | `docker build` → `yanisght/souverainrecrut-backend:<tag>` | arrêt |
| 7 | Scan Trivy | `trivy image --severity CRITICAL --exit-code 1` | **arrêt : l'image n'est pas publiée** |
| 8 | Publication Docker Hub | `docker login --password-stdin`, `docker push`, `docker logout` | - |

**Traçabilité** : le tag associe la version de `backend/package.json` et le commit court. Toute image publiée renvoie donc à un état précis du code.

**Secrets** : le token SonarQube et les identifiants Docker Hub sont des credentials Jenkins (`sonarqube-token`, `dockerhub`). Ils sont injectés par `withSonarQubeEnv` et `withCredentials`, et masqués dans les logs (`******`).

## Mise en place

```bash
# SonarQube
docker run -d --name sonarqube -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data -v sonarqube_extensions:/opt/sonarqube/extensions -v sonarqube_logs:/opt/sonarqube/logs \
  sonarqube:community

# Jenkins (image construite depuis jenkins/Dockerfile)
docker build -t souverainrecrut-jenkins jenkins/
docker run -d --name jenkins -p 8080:8080 \
  -v jenkins_home:/var/jenkins_home -v /var/run/docker.sock:/var/run/docker.sock --group-add 0 \
  souverainrecrut-jenkins
```

Dans Jenkins :
1. Credentials : `sonarqube-token` (Secret text) et `dockerhub` (Username with password, avec un token Docker Hub).
2. *Manage Jenkins > System > SonarQube servers* : nom `sonarqube`, URL `http://host.docker.internal:9000`, token `sonarqube-token`.
3. Job Pipeline `souverainrecrut-backend` : *Pipeline script from SCM*, dépôt GitHub, branche `Dev`, script `Jenkinsfile`.

Dans SonarQube : projet `souverainrecrut-backend` et Quality Gate « SouverainRecrut » appliqué au projet : couverture ≥ 80 % et duplication ≤ 3 %, sur tout le code et sur le code neuf, plus une note de sécurité au moins égale à D.

Le Quality Gate est attendu par le scanner (`sonar.qualitygate.wait=true`) plutôt que par un webhook : SonarQube 26 refuse d'envoyer des webhooks vers des adresses privées, comme `host.docker.internal`.

## Résultats (build #2, commit `4670db8`)

| Contrôle | Résultat | Rapport |
|---|---|---|
| Tests | **59 / 59 réussis**, 5 suites | `reports/tests-jest.txt` |
| Couverture (Jest) | lignes 87,62 %, instructions 87,73 %, fonctions 71,42 %, branches 56,52 % | `reports/tests-jest.txt` (tableau de couverture), `reports/coverage/lcov.info` |
| SonarQube | **Quality Gate PASSED** : couverture 82,5 %, duplication 0 %, sécurité B | `sonar/resultats-sonarqube.md`, `sonar/quality-gate.png` |
| Trivy | **0 vulnérabilité CRITICAL** sur l'image publiée | `reports/trivy-1.0.0-4670db8.txt` |
| Publication | `yanisght/souverainrecrut-backend:1.0.0-4670db8` sur Docker Hub | - |

## Trivy : seuil et correction

Seuil retenu : **aucune vulnérabilité CRITICAL**. Trivy est lancé avec `--exit-code 1`, ce qui arrête le pipeline avant la publication. Les vulnérabilités de sévérité inférieure ne bloquent pas la publication.

L'image d'origine du dépôt ne passait pas ce seuil :

| Image | Vulnérabilités CRITICAL | Correction |
|---|---|---|
| Image d'origine (Node 20) | 2 : `proxy-addr` 2.0.7 (CVE-2026-90711), `tar` embarqué dans npm (CVE-2026-59873) | - |
| Node 22.20.0 (1re tentative) | 6 : OpenSSL d'Alpine 3.22 (2), `tar` embarqué dans npm (3), `proxy-addr` 2.0.7 (1) | changer de version de Node ne suffit pas : l'image de base doit être récente et `proxy-addr` mis à jour |
| **Node 22.23.4 + `proxy-addr` 2.0.8** | **0** | image de base figée en version récente + dépendance mise à jour dans `package-lock.json` |
