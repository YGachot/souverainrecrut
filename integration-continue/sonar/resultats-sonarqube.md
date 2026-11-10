# Résultats SonarQube - SouverainRecrut Backend

- **Serveur** : SonarQube Community Build 26.11 (conteneur local)
- **Projet** : `souverainrecrut-backend`, configuré par `backend/sonar-project.properties`
- **Analyse** : lancée par le pipeline Jenkins, build #2, commit `4670db8`
- **Résultat** : `QUALITY GATE STATUS: PASSED` (capture : `quality-gate.png`)

## Quality Gate « SouverainRecrut »

| Condition (sur l'ensemble du code) | Seuil d'échec | Valeur mesurée | Statut |
|---|---|---|---|
| Couverture | < 80 % | **82,5 %** | OK |
| Lignes dupliquées | > 3 % | **0,0 %** | OK |
| Note de sécurité | pire que D | **B** | OK |

Le pipeline Jenkins attend le verdict (`sonar.qualitygate.wait=true`) : si le Quality Gate échoue, le build s'arrête avant la construction de l'image Docker.

## Mesures

| Mesure | Valeur |
|---|---|
| Lignes de code | 2 714 |
| Couverture globale (lignes + branches) | 82,5 % |
| Couverture des lignes | 86,1 % (70 lignes non couvertes sur 503) |
| Couverture des branches | 56,5 % |
| Duplications | 0,0 % |
| Bugs | 0 (fiabilité A) |
| Vulnérabilités | 1 (sécurité B) |
| Security hotspots | 0 |
| Code smells | 2 (maintenabilité A) |

## Problèmes ouverts

| Sévérité | Type | Règle | Emplacement | Message |
|---|---|---|---|---|
| Mineure | Vulnérabilité | typescript:S5689 | `src/app.ts:15` | Express annonce sa version par défaut (en-tête `X-Powered-By`) |
| Mineure | Code smell | typescript:S7773 | `src/utils/pagination.ts:28` | Préférer `Number.parseInt` à `parseInt` |
| Mineure | Code smell | typescript:S7773 | `src/utils/pagination.ts:31` | Préférer `Number.parseInt` à `parseInt` |

Ces trois points sont mineurs et ne bloquent pas le Quality Gate. Ils concernent le code applicatif fourni, hors du périmètre CI/CD du projet.

## Exclusions configurées

| Paramètre | Valeur | Raison |
|---|---|---|
| `sonar.coverage.exclusions` | `src/server.ts`, `src/docs/**`, `src/types/**` | point d'entrée (démarrage du serveur), documentation Swagger et types : pas de logique testable |
| `sonar.cpd.exclusions` | `src/docs/**` | les fichiers Swagger se ressemblent par nature : ils faisaient monter la duplication à 20,8 % |
