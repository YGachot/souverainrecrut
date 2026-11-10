# Résultats SonarQube - SouverainRecrut Backend

- **Serveur** : SonarQube Community Build 26.11 (conteneur local)
- **Projet** : `souverainrecrut-backend`, configuré par `backend/sonar-project.properties`
- **Analyse** : lancée par le pipeline Jenkins, build #2, commit `4670db8`
- **Résultat** : `QUALITY GATE STATUS: PASSED` (capture : `quality-gate.png`)

## Quality Gate « SouverainRecrut »

| Condition | Seuil d'échec | Valeur mesurée | Statut |
|---|---|---|---|
| Couverture (tout le code) | < 80 % | **82,5 %** | OK |
| Lignes dupliquées (tout le code) | > 3 % | **0,0 %** | OK |
| Note de sécurité (tout le code) | pire que D | **B** | OK |
| Couverture du code neuf | < 80 % | pas encore de code neuf | non évaluée |
| Lignes dupliquées du code neuf | > 3 % | pas encore de code neuf | non évaluée |

Le pipeline Jenkins attend le verdict (`sonar.qualitygate.wait=true`) : si le Quality Gate échoue, le build s'arrête avant la construction de l'image Docker.

## Mesures

| Mesure | Valeur |
|---|---|
| Lignes de code | 2 714 |
| Couverture globale (lignes + branches) | 82,5 % |
| Couverture des lignes | 86,1 % (70 lignes non couvertes sur 503) |
| Couverture des branches | 56,5 % |
| Duplications | 0,0 % |
| Sécurité | 1 problème, note **B** |
| Fiabilité | 2 problèmes, note **C** |
| Maintenabilité | 2 problèmes, note **A** |
| Security hotspots | 0 |

SonarQube 26 classe les problèmes par qualité logicielle (mode MQR). Un même problème peut toucher plusieurs qualités : les 2 problèmes `parseInt` comptent à la fois en fiabilité et en maintenabilité. Il y a donc 3 problèmes ouverts au total.

## Problèmes ouverts (3)

| Qualité touchée (sévérité) | Règle | Emplacement | Message |
|---|---|---|---|
| Sécurité (Low) | typescript:S5689 | `src/app.ts:15` | Express annonce sa version par défaut (en-tête `X-Powered-By`) |
| Fiabilité (Medium), Maintenabilité (Low) | typescript:S7773 | `src/utils/pagination.ts:28` | Préférer `Number.parseInt` à `parseInt` |
| Fiabilité (Medium), Maintenabilité (Low) | typescript:S7773 | `src/utils/pagination.ts:31` | Préférer `Number.parseInt` à `parseInt` |

Aucun de ces points ne bloque le Quality Gate, dont les conditions portent sur la couverture, la duplication et la sécurité. Ils concernent le code applicatif fourni, hors du périmètre CI/CD du projet.

## Exclusions configurées

| Paramètre | Valeur | Raison |
|---|---|---|
| `sonar.coverage.exclusions` | `src/server.ts`, `src/docs/**`, `src/types/**` | point d'entrée (démarrage du serveur), documentation Swagger et types : pas de logique testable |
| `sonar.cpd.exclusions` | `src/docs/**` | les fichiers Swagger se ressemblent par nature : ils faisaient monter la duplication à 20,8 % |
