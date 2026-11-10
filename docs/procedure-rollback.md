# Procédure de rollback - SouverainRecrut Backend

Le rollback consiste à redéployer une **image précédente déjà publiée sur Docker Hub**. Aucune image n'est reconstruite.

## 1. Identifier la version en cours et la version précédente

Version en cours, sur le serveur :

```bash
cd /opt/souverainrecrut
docker compose ps --format "{{.Service}} {{.Image}}"
```

Versions disponibles : onglet *Tags* du dépôt Docker Hub `yanisght/souverainrecrut-backend`, ou historique des pipelines GitLab. Le tag `<version>-<commit>` renvoie directement au commit du code :

| Tag | Commit | Contenu |
|---|---|---|
| `1.0.0-4670db8` | `4670db8` | version actuelle (pipeline Jenkins complet) |
| `1.0.0-47bce34` | `47bce34` | **version précédente** (Dockerfile Node 22 et correctif `proxy-addr`) |

## 2. Vérifier la compatibilité du schéma de base de données

Un rollback applicatif ne défait pas les migrations déjà appliquées. Avant de revenir en arrière, comparer les migrations Prisma des deux versions :

```bash
git diff --stat 47bce34 4670db8 -- backend/prisma
```

- **Aucune différence** : le rollback ne pose pas de problème de schéma (cas testé ici : les deux images contiennent la seule migration `20260630124434_init`).
- **La version actuelle a ajouté une migration** : l'ancienne image fonctionnera avec un schéma plus récent seulement si cette migration n'a fait qu'**ajouter** des éléments (tables, colonnes facultatives). Si elle a supprimé ou renommé une colonne, ou rendu une colonne obligatoire, l'ancienne version peut ne plus fonctionner. Il faut alors corriger avec une nouvelle version et une migration corrective, plutôt que revenir en arrière.

Règle retenue pour les migrations Prisma : une migration ne fait qu'ajouter. La suppression ou le renommage d'éléments se fait dans une version ultérieure, une fois que plus aucune version déployable ne les utilise. Le service `migrate` applique uniquement `prisma migrate deploy` : il n'exécute jamais de migration descendante et ne réinitialise jamais la base.

## 3. Lancer le rollback (GitLab)

1. *Build > Pipelines > New pipeline*, branche `main`.
2. Variable `IMAGE_TAG` = `1.0.0-47bce34`.
3. `valider-tag` vérifie que ce tag existe sur Docker Hub.
4. Approuver `deployer-production` (▶).
5. `docker compose up -d` recrée uniquement `migrate` et `backend` avec l'ancienne image. `db` et son volume ne sont pas touchés.
6. `verifier-deploiement` doit afficher `Image en cours d'exécution : yanisght/souverainrecrut-backend:1.0.0-47bce34`, puis des réponses `UP` et `READY`.

Pour que le rollback soit durable, mettre aussi la variable de projet `IMAGE_TAG` à `1.0.0-47bce34`.

## 4. Vérifier après le rollback

```bash
curl http://192.168.42.129:4000/v1/ready          # "database":"CONNECTED"
ssh yanis@192.168.42.129 'cd /opt/souverainrecrut && docker compose ps && docker compose logs migrate | tail -1'
```

Contrôler aussi que les données existantes sont toujours présentes, par exemple avec `GET /v1/candidates`.

## 5. Revenir à la version actuelle

Même procédure, avec `IMAGE_TAG` = `1.0.0-4670db8`.

## Test réalisé (scénario maîtrisé)

| Étape | Pipeline GitLab | Image en cours | Données | API |
|---|---|---|---|---|
| Situation initiale | #3049258782 | `1.0.0-4670db8` | 1 utilisateur, 1 candidat, 1 offre, 1 candidature | UP / READY |
| Rollback | #3049361800 | `1.0.0-47bce34` | identiques | UP / READY |
| Retour à la version actuelle | #3049490490 | `1.0.0-4670db8` | identiques | UP / READY |

Pendant les deux changements de version, le conteneur `db` n'a pas été recréé. Après le retour à la version actuelle, `migrate` indique `No pending migrations to apply` : le schéma n'a pas changé.
