# Rapport final - Projet CI/CD SouverainRecrut Backend

**Module** : CI/CD, M2 Sup de Vinci Rennes. **Formateur** : Alimou Diallo.
**Dépôt** : `github.com/YGachot/souverainrecrut` (branche `Dev`), fork de `github.com/Santoudllo/souverainrecrut`.
**Projet de déploiement** : `gitlab.com/YGachot/souverainrecrut-deploiement`.

## 1. Objectif

Mettre en place une chaîne complète et reproductible pour l'API Backend (Node.js 22, Express, TypeScript, Prisma, PostgreSQL) :

- une **intégration continue** avec Jenkins, qui teste, analyse, construit, scanne et publie une image Docker versionnée ;
- un **déploiement continu** avec GitLab CI/CD, qui récupère cette image et la déploie sur un serveur Ubuntu préparé avec Ansible et Terraform.

Le Frontend est hors périmètre.

## 2. Réalisations

### Intégration continue (Jenkins)

| § | Réalisation | Résultat |
|---|---|---|
| 3.1 | Fork, clone, branche `Dev`, `npm ci`, `prisma generate` | dépôt prêt |
| 3.2 | Jest + ts-jest + Supertest, Prisma simulé (`jest-mock-extended`) : 5 suites (authentification, candidats, offres, candidatures, contrôle des accès) | **59/59 tests**, couverture des lignes 87,62 %, `coverage/lcov.info` |
| 3.3 | SonarQube Community 26.11, projet `souverainrecrut-backend`, Quality Gate « SouverainRecrut » | **PASSED** : couverture 82,5 %, duplication 0 %, sécurité B, 0 security hotspot |
| 3.4 | Jenkins en conteneur (plugins Git, Pipeline, SonarQube, Credentials Binding), credentials `sonarqube-token` et `dockerhub` | aucun secret dans le dépôt |
| 3.5 | `Jenkinsfile` en 8 étapes, chaque contrôle étant bloquant | build #2 **SUCCESS** |
| 3.6 | Dockerfile multi-stage figé (Node 22.23.4 Alpine), `.dockerignore`, tag `version-commit`, Trivy avec seuil 0 CRITICAL | `yanisght/souverainrecrut-backend:1.0.0-4670db8` publiée |

### Provisionnement et déploiement

| § | Réalisation | Résultat |
|---|---|---|
| 4.1 | VM Ubuntu Server 24.04 sous VMware Workstation (2 vCPU, 4 Go, NAT), SSH, snapshot | serveur `192.168.42.129` |
| 4.2 | Terraform (`main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`) | inventaire Ansible généré |
| 4.3 | Playbook Ansible : mise à jour, Docker Engine + Compose, service actif, répertoire de déploiement, vérifications | `failed=0`, idempotent (`changed=0` à la relance) |
| 4.4 | Projet GitLab dédié, `.gitlab-ci.yml`, runner local, 9 variables (4 secrets masqués, cachés et protégés) | pipeline de préparation réussi |
| 5.1 | Le serveur récupère l'image sur Docker Hub (`docker compose pull`) | aucune reconstruction |
| 5.2 | `deployment/docker-compose.yml` (PostgreSQL, migrations, API) et `.env.example` | volume persistant, réseau dédié, redémarrage automatique, healthchecks |
| 5.3 | Pipeline : validation du tag → approbation manuelle → déploiement SSH → vérification | pipeline #3049258782 réussi |
| 5.4 | Tests des endpoints, de la communication avec PostgreSQL, de la persistance et du rollback | 14 appels OK, données conservées, rollback vers `1.0.0-47bce34` puis retour |

## 3. Choix techniques

| Choix | Justification |
|---|---|
| Prisma simulé dans les tests | les tests s'exécutent dans Jenkins sans base de données, rapidement et de façon reproductible ; Supertest teste les routes réelles (validation, authentification, rôles) |
| Quality Gate attendu par le scanner (`sonar.qualitygate.wait=true`) | SonarQube 26 refuse les webhooks vers des adresses privées (`host.docker.internal`) |
| Exclusion des fichiers Swagger de la détection de duplication | leur structure répétitive faisait monter la duplication à 20,8 % sans relever d'un vrai défaut |
| Seuil Trivy : 0 CRITICAL | bloque les risques majeurs sans rendre la publication impossible à cause de vulnérabilités HIGH dans des dépendances d'outils (npm) |
| Tag `version-commit` | relie chaque image à la version applicative et au commit exact |
| Terraform limité à l'inventaire | VMware Workstation ne propose pas d'API pour Terraform (le provider vSphere exige ESXi ou vCenter) ; Terraform décrit le serveur existant et alimente Ansible |
| Runner GitLab local | la VM est sur le réseau NAT de VMware, inaccessible depuis les runners de gitlab.com |
| Service `migrate` séparé | le CLI Prisma n'est pas dans l'image de production ; `prisma migrate deploy` (même version que le client) s'exécute une fois, avant l'API, qui ne démarre pas si une migration échoue |
| Healthcheck de l'API sur `/v1/ready` | cette route répond 200 seulement si l'API joint PostgreSQL |
| `.env` écrit par le pipeline | les secrets restent dans GitLab ; sur le serveur, le fichier n'est lisible que par l'utilisateur de déploiement (droits 600) |
| Deux tokens Docker Hub | Jenkins publie (écriture), le serveur ne fait que lire (lecture seule) |
| Approbation manuelle (`when: manual`, bloquante) | aucun déploiement en production sans validation humaine |

## 4. Difficultés rencontrées et solutions

| Problème | Cause | Solution |
|---|---|---|
| Image d'origine refusée par Trivy (2 CRITICAL) | `proxy-addr` 2.0.7 et `tar` embarqué dans npm (image Node 20) | Node 22.23.4 Alpine figé + `proxy-addr` 2.0.8 → 0 CRITICAL |
| Passage à Node 22.20.0 : 6 CRITICAL | OpenSSL d'Alpine 3.22 (2), `tar` embarqué dans npm (3), `proxy-addr` 2.0.7 (1) | image Node 22.23.4 (Alpine 3.24) figée dans le Dockerfile + `proxy-addr` 2.0.8 |
| Jenkins ne pouvait pas utiliser Docker | droits insuffisants sur le socket Docker | `--group-add 0` au lancement du conteneur |
| Duplication SonarQube à 20,8 % | fichiers de documentation Swagger | `sonar.cpd.exclusions=src/docs/**` |
| Webhook SonarQube refusé | protection de SonarQube 26 contre les adresses privées | attente du Quality Gate par le scanner |
| Serveur injoignable depuis gitlab.com | VM en NAT | runner GitLab installé sur le poste de travail |
| `permission denied` sur Docker pour le pipeline | utilisateur `yanis` absent du groupe `docker` | tâche ajoutée au playbook Ansible |
| Pipeline invalide (détecté avant envoi) | ligne YAML `echo "… : …"` interprétée comme une clé | ligne passée en bloc littéral (`|`) |
| CLI Prisma absent de l'image de production | `prisma` est une dépendance de développement | service `migrate` avec `npx prisma@6.16.2 migrate deploy` |
| Base de production vide, aucune route d'inscription | conception de l'API | création d'un administrateur initial sur le serveur (mot de passe haché, jamais affiché) |

## 5. Conformité aux exigences (§7)

| Exigence | Mise en œuvre |
|---|---|
| Reproductibilité | `Jenkinsfile`, Terraform, playbook Ansible, `docker-compose.yml` et `.gitlab-ci.yml` versionnés ; procédures dans `deploiement/README.md`, `integration-continue/README.md` et `docs/` |
| Qualité logicielle | tests exécutés à chaque build ; couverture (`integration-continue/reports/`) et résultats SonarQube (`integration-continue/sonar/`) consultables |
| Sécurité | secrets dans les credentials Jenkins et les variables GitLab protégées ; aucun secret versionné ni affiché ; image scannée par Trivy avant publication |
| Traçabilité | tag `version-commit` ; le pipeline vérifie que l'image en cours d'exécution est celle demandée |
| Déploiement | le serveur récupère l'image publiée ; l'API démarre avec PostgreSQL (`/v1/ready` : `CONNECTED`) |
| Continuité | rollback documenté (`procedure-rollback.md`) et testé |
| Documentation | architecture, choix techniques, prérequis et procédures décrits |

## 6. Du code à l'API déployée

```
git push (Dev, commit 4670db8)
  → Jenkins build #2 : tests 59/59, Quality Gate PASSED, Trivy 0 CRITICAL
  → Docker Hub : yanisght/souverainrecrut-backend:1.0.0-4670db8
  → GitLab pipeline : tag validé → approbation → déploiement SSH → vérification
  → http://192.168.42.129:4000/v1/health : UP
```

## 7. Limites

- Les vulnérabilités HIGH ne bloquent pas la publication : seuil choisi pour le projet.
- La couverture des branches (56,5 %) est nettement plus faible que celle des lignes.
- SonarQube signale 3 points mineurs dans le code applicatif fourni (en-tête `X-Powered-By`, `parseInt`).
- Le runner GitLab, Jenkins et SonarQube tournent sur le poste de travail : la chaîne dépend de sa disponibilité.

## 8. Captures d'écran

Dossier `docs/captures/`. Les captures `term-*` reproduisent des sorties de commandes réelles, non modifiées.

| Étape | Captures |
|---|---|
| Architecture | `schema-architecture.png` |
| §3.2 Tests et couverture | `term-tests.png`, `coverage-report.png` |
| §3.3 SonarQube | `sonar-qualitygate.png`, `sonar-overview.png`, `sonar-issues.png` |
| §3.4 Jenkins | `jenkins-credentials.png`, `jenkins-sonar-server.png` |
| §3.5 Pipeline Jenkins | `jenkins-build-stages.png`, `term-jenkins-console.png`, `term-gitlog.png` |
| §3.6 Trivy et Docker Hub | `term-trivy-avant.png`, `term-trivy-inter.png`, `term-trivy-apres.png`, `dockerhub-tags.png` |
| §4.2 Terraform | `term-terraform.png` |
| §4.3 Ansible | `term-ansible-inventaire.png`, `term-ansible-playbook.png`, `term-ansible-verification.png` |
| §4.4 GitLab | `gitlab-runner-online.png`, `term-gitlab-runner.png`, `gitlab-variables.png`, `gitlab-pipeline.png`, `gitlab-jobs.png`, `gitlab-job-log.png` |
| §5.1 à §5.3 Déploiement | `gitlab-variables-5.3.png`, `gitlab-approbation.png`, `gitlab-pipeline-deploiement.png`, `gitlab-log-deploiement.png`, `gitlab-log-verification.png`, `term-serveur-deploiement.png` |
| §5.4 Vérifications | `api-endpoints.png`, `persistance-redemarrage.png`, `term-persistance.png` |
| §5.4 Rollback | `rollback-formulaire.png`, `rollback-pipeline.png`, `rollback-verification.png`, `retour-version.png`, `term-rollback-donnees.png` |
