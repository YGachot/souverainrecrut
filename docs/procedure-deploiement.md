# Procédure de déploiement - SouverainRecrut Backend

Cette procédure déploie l'API Backend sur le serveur Ubuntu à partir d'une image publiée sur Docker Hub par Jenkins. Les fichiers cités se trouvent dans `deploiement/`.

## Prérequis

| Élément | Valeur utilisée |
|---|---|
| Serveur | VM VMware Workstation, Ubuntu Server 24.04 LTS, 2 vCPU, 4 Go RAM, réseau NAT, SSH activé |
| Adresse / utilisateur | `192.168.42.129` / `yanis` |
| Poste de travail | Terraform, WSL Ubuntu avec `ansible-core`, Docker Desktop, Git |
| Image | `yanisght/souverainrecrut-backend:<version>-<commit>` publiée par Jenkins |
| GitLab | projet `souverainrecrut-deploiement` + runner local |

## 1. Préparer la VM (une fois)

1. Créer la VM dans VMware Workstation et installer Ubuntu Server 24.04 avec OpenSSH.
2. Mettre le système à jour, puis relever l'adresse IP : `ip a`.
3. Vérifier l'accès Internet (`ping -c 2 ubuntu.com`) et la connexion SSH depuis le poste.
4. Prendre un snapshot avant toute configuration.

## 2. Créer la clé de déploiement (une fois, dans WSL)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/souverainrecrut_deploy -C deploy-souverainrecrut
ssh-copy-id -i ~/.ssh/souverainrecrut_deploy.pub yanis@192.168.42.129
```

## 3. Générer l'inventaire avec Terraform (une fois)

```bash
cd deploiement/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

Résultat : `deploiement/ansible/inventory.ini`. Sans ESXi ni vCenter, la VM est créée manuellement ; Terraform décrit le serveur et produit l'inventaire SSH utilisé par Ansible.

## 4. Préparer le serveur avec Ansible (une fois, dans WSL)

```bash
cd deploiement/ansible
ansible -i inventory.ini app -m ping
ansible-playbook -i inventory.ini playbook.yml --ask-become-pass
```

Le playbook met à jour le système, installe Docker Engine et le plugin Compose, active le service Docker, crée `/opt/souverainrecrut` et autorise `yanis` à utiliser Docker. Sa dernière tâche vérifie l'ensemble. Résultat attendu : `failed=0`.

## 5. Configurer GitLab (une fois)

1. Créer le projet GitLab **vide** (sans README initial), puis y publier le contenu de `deploiement/` :
   ```bash
   git remote add gitlab https://gitlab.com/YGachot/souverainrecrut-deploiement.git
   git subtree push --prefix=deploiement gitlab main
   ```
2. Créer un runner de projet avec le tag `souverainrecrut`, puis l'enregistrer sur le poste :
   ```bash
   docker run -d --name gitlab-runner --restart always \
     -v gitlab-runner-config:/etc/gitlab-runner -v /var/run/docker.sock:/var/run/docker.sock \
     gitlab/gitlab-runner:v19.5.3
   docker exec -it gitlab-runner gitlab-runner register --url https://gitlab.com --executor docker --docker-image alpine:3.24.4
   ```
3. Créer les variables CI/CD dans *Settings > CI/CD > Variables* (liste dans `deploiement/README.md`). Les secrets (`DOCKERHUB_TOKEN`, `SSH_PRIVATE_KEY_B64`, `POSTGRES_PASSWORD`, `JWT_SECRET`) sont en **Masked and hidden** et **Protected**.

## 6. Déployer

1. Dans GitLab : *Build > Pipelines > New pipeline*, branche `main`. Renseigner la variable `IMAGE_TAG` pour une version différente de celle définie dans le projet.
2. `valider-tag` contrôle les variables, le format du tag et sa présence sur Docker Hub.
3. Le pipeline s'arrête sur `deployer-production` : **approuver le déploiement** en cliquant sur ▶.
4. `deployer-production` se connecte au serveur en SSH et effectue, dans l'ordre :
   - copie de `docker-compose.yml` dans `/opt/souverainrecrut` ;
   - écriture du `.env` à partir des variables GitLab (droits `600`) ;
   - `docker login` → `docker compose pull` → `docker logout` ;
   - `docker compose up -d` : PostgreSQL, puis les migrations Prisma (`migrate`), puis l'API.
5. `verifier-deploiement` contrôle l'état des conteneurs, vérifie que l'image en cours d'exécution est celle demandée, puis appelle `/v1/health` et `/v1/ready`.

## 7. Vérifier

Depuis le poste :

```bash
curl http://192.168.42.129:4000/v1/health   # "status":"UP"
curl http://192.168.42.129:4000/v1/ready    # "status":"READY","database":"CONNECTED"
```

Sur le serveur :

```bash
cd /opt/souverainrecrut
docker compose ps                 # db et backend "healthy", migrate "Exited (0)"
docker compose logs migrate       # migrations appliquées ou "No pending migrations to apply"
docker compose logs -f backend
```

### Compte initial

L'API n'expose pas de route d'inscription. Pour tester les routes protégées sur une base neuve, créer un administrateur sur le serveur. Le mot de passe est saisi sans être affiché et stocké haché (bcrypt) :

```bash
cd /opt/souverainrecrut
read -rsp "Mot de passe admin : " P; echo
echo "$P" | docker compose exec -T backend node -e '
const {PrismaClient}=require("@prisma/client");const b=require("bcrypt");const p=new PrismaClient();
let P="";process.stdin.on("data",d=>P+=d).on("end",async()=>{const h=await b.hash(P.trim(),10);
const u=await p.user.create({data:{firstName:"Admin",lastName:"SouverainRecrut",email:"admin@souverainrecrut.com",password:h,role:"ADMIN"}});
console.log("Compte créé :",u.email,u.role);await p.$disconnect();});'
unset P
```

### Résultats obtenus

| Vérification | Résultat |
|---|---|
| `/v1/health`, `/v1/ready`, `/v1/info` | 200 |
| `/v1/candidates` sans jeton | 401 (accès protégé) |
| `POST /v1/auth/login`, `GET /v1/auth/me` | jeton obtenu, 200 |
| Création d'un candidat, d'une offre et d'une candidature | 201 |
| Lecture des candidats, des offres et des candidatures | 200 |
| Données relues directement dans PostgreSQL | 1 utilisateur, 1 candidat, 1 offre, 1 candidature |
| Persistance : `docker compose down` puis `up -d` | mêmes données après recréation des conteneurs |

## Livrer une nouvelle version du code

1. Pousser le code sur la branche `Dev` de GitHub.
2. Lancer le job Jenkins : tests, SonarQube, build, Trivy, puis publication de `yanisght/souverainrecrut-backend:<version>-<commit>`.
3. Lancer le pipeline GitLab avec `IMAGE_TAG` égal à ce nouveau tag, puis approuver le déploiement.
4. Mettre à jour la variable de projet `IMAGE_TAG` dans GitLab pour qu'elle désigne la version en production.
