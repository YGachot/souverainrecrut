# Déploiement continu - SouverainRecrut Backend

Ce dossier contient tout ce qui permet de déployer l'API Backend sur un serveur Linux à partir de l'image Docker publiée sur Docker Hub par Jenkins (voir la partie intégration continue). L'image n'est **jamais reconstruite** au moment du déploiement.

Il est aussi publié tel quel, à la racine d'un projet GitLab dédié au déploiement (`souverainrecrut-deploiement`).

## Contenu

```
deploiement/
├── terraform/                 Description du serveur et génération de l'inventaire Ansible (§4.2)
│   ├── providers.tf
│   ├── variables.tf
│   ├── main.tf
│   ├── outputs.tf
│   └── .terraform.lock.hcl    versions de providers figées
├── ansible/                   Préparation du serveur (§4.3)
│   ├── inventory.ini          généré par Terraform, ne pas modifier à la main
│   └── playbook.yml
├── deployment/                Services exécutés sur le serveur (§5.2)
│   ├── docker-compose.yml     Backend + PostgreSQL + migrations Prisma
│   └── .env.example           modèle de configuration (le vrai .env n'est jamais versionné)
├── .gitlab-ci.yml             Pipeline de déploiement GitLab (§4.4, §5.3)
└── README.md
```

## Chaîne de déploiement

| Étape | Outil | Où | Rôle |
|---|---|---|---|
| 1 | VMware Workstation | poste de travail | héberge le serveur : VM Ubuntu Server 24.04 (réseau NAT) |
| 2 | Terraform | poste de travail | décrit le serveur (IP, utilisateur SSH, répertoire) et génère `ansible/inventory.ini` |
| 3 | Ansible | poste de travail (WSL) | installe Docker Engine et Docker Compose, crée `/opt/souverainrecrut`, autorise l'utilisateur de déploiement à utiliser Docker |
| 4 | GitLab CI/CD | runner local | valide le tag, attend l'approbation manuelle, déploie par SSH, vérifie |
| 5 | Docker Compose | serveur | démarre PostgreSQL, applique les migrations Prisma, démarre l'API |

VMware Workstation n'expose pas d'API exploitable par Terraform (il faudrait ESXi ou vCenter). La VM est donc créée manuellement, et Terraform décrit le serveur existant et fait le lien avec Ansible en générant l'inventaire.

## Prérequis

- Une VM Ubuntu Server 24.04 accessible en SSH (ici `192.168.42.129`, utilisateur `yanis`).
- Sur le poste de travail : Terraform ≥ 1.6, WSL Ubuntu avec `ansible-core`, Docker Desktop.
- Un compte Docker Hub contenant l'image `souverainrecrut-backend` publiée par Jenkins.
- Un projet GitLab avec un runner pouvant joindre le serveur. Le serveur étant en NAT, les runners partagés de gitlab.com ne le voient pas : un runner local est utilisé (tag `souverainrecrut`).

## Mise en place

### 1. Clé SSH de déploiement (WSL)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/souverainrecrut_deploy -C deploy-souverainrecrut
ssh-copy-id -i ~/.ssh/souverainrecrut_deploy.pub yanis@192.168.42.129
```

La clé privée reste sur le poste et dans les variables sécurisées de GitLab. Elle n'est jamais versionnée.

### 2. Terraform : inventaire du serveur

```bash
cd deploiement/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

`terraform apply` génère `../ansible/inventory.ini`. Les valeurs (IP, utilisateur, chemin de la clé) se modifient dans `variables.tf` ou avec `-var`.

### 3. Ansible : préparation du serveur (WSL)

```bash
cd deploiement/ansible
ansible -i inventory.ini app -m ping
ansible-playbook -i inventory.ini playbook.yml --ask-become-pass
```

Le playbook est idempotent : relancé, il ne modifie plus rien (`changed=0`). Sa dernière tâche contrôle l'état du serveur : service Docker actif, versions de Docker et de Compose, présence de `/opt/souverainrecrut`.

### 4. GitLab : runner et variables

Runner local (Docker Desktop), créé dans *Settings > CI/CD > Runners* avec le tag `souverainrecrut` :

```bash
docker run -d --name gitlab-runner --restart always \
  -v gitlab-runner-config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:v19.5.3
docker exec -it gitlab-runner gitlab-runner register --url https://gitlab.com --executor docker --docker-image alpine:3.24.4
```

Variables CI/CD (*Settings > CI/CD > Variables*) :

| Variable | Contenu | Protection |
|---|---|---|
| `DOCKERHUB_USERNAME` | compte Docker Hub | - |
| `DOCKERHUB_TOKEN` | token Docker Hub **en lecture seule** | Masked and hidden, Protected |
| `SERVER_HOST` | adresse du serveur | - |
| `SSH_USER` | utilisateur SSH | - |
| `SSH_PRIVATE_KEY_B64` | clé privée de déploiement encodée en base64 (`base64 -w0`) | Masked and hidden, Protected |
| `SSH_KNOWN_HOSTS` | clé d'hôte du serveur (`ssh-keyscan -t ed25519 <ip>`) | - |
| `IMAGE_TAG` | tag de l'image à déployer, format `version-commit` | - |
| `POSTGRES_PASSWORD` | mot de passe PostgreSQL (lettres et chiffres uniquement) | Masked and hidden, Protected |
| `JWT_SECRET` | secret de signature des jetons | Masked and hidden, Protected |

Publication du dossier dans le projet GitLab (depuis la racine du dépôt) :

```bash
git subtree push --prefix=deploiement gitlab main
```

## Pipeline de déploiement

| Stage | Job | Rôle |
|---|---|---|
| validation | `valider-tag` | variables présentes, mot de passe compatible, tag au format `x.y.z-commit` et **présent sur Docker Hub** |
| deploiement | `deployer-production` | **approbation manuelle** puis, par SSH : copie de `docker-compose.yml`, écriture du `.env` (droits `600`), `docker login` / `docker compose pull` / `docker logout`, `docker compose up -d` |
| verification | `verifier-deploiement` | `docker compose ps`, attente de l'état `healthy`, contrôle que l'image en cours d'exécution est celle demandée, appels à `/v1/health` et `/v1/ready` |

Déployer une autre version : *Build > Pipelines > New pipeline*, variable `IMAGE_TAG` = tag voulu.

## Services sur le serveur (`deployment/docker-compose.yml`)

| Service | Image | Rôle |
|---|---|---|
| `db` | `postgres:17.11-alpine3.24` | base de données, volume persistant `postgres-data`, healthcheck `pg_isready` |
| `migrate` | image Backend | exécute `prisma migrate deploy` une fois PostgreSQL prêt, puis s'arrête |
| `backend` | image Backend | API sur le port 4000, démarrée seulement si les migrations ont réussi, healthcheck sur `/v1/ready` |

Les trois services partagent le réseau `backend`. `db` et `backend` redémarrent automatiquement (`unless-stopped`).

**Migrations Prisma** : le CLI Prisma n'est pas dans l'image de production. Le service `migrate` utilise la même image et le CLI de la même version que `@prisma/client` (6.16.2). `migrate deploy` applique uniquement les migrations versionnées dans l'image : il ne génère rien, ne réinitialise jamais la base, et ne fait rien s'il n'y a rien à appliquer.

## Vérification rapide

```bash
curl http://192.168.42.129:4000/v1/health   # {"status":"UP"}
curl http://192.168.42.129:4000/v1/ready    # {"status":"READY","database":"CONNECTED"}
```

Sur le serveur :

```bash
cd /opt/souverainrecrut
docker compose ps
docker compose logs -f
```

## Sécurité

- Aucun secret dans le dépôt : `.env` et l'état Terraform (`*.tfstate`, `*.tfvars`) sont exclus par `.gitignore`. La clé privée de déploiement reste hors du dépôt (dans `~/.ssh` sous WSL et dans une variable GitLab).
- Les secrets sont dans les variables GitLab (Masked and hidden, Protected) et n'apparaissent pas dans les logs : seuls les noms des variables sont affichés.
- Le token Docker Hub et le contenu du `.env` passent par l'entrée standard de SSH, jamais en argument de commande. Les identifiants Docker Hub sont supprimés du serveur après le `pull` (`docker logout`).
- L'identité du serveur est vérifiée (`SSH_KNOWN_HOSTS`) : pas de `StrictHostKeyChecking=no`.

## Documentation associée

- `docs/architecture.md`
- `docs/procedure-deploiement.md`
- `docs/procedure-rollback.md`
- `docs/rapport-final.md`
