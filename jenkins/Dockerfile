# Image Jenkins du projet SouverainRecrut
# - plugins Git, Pipeline, SonarQube + Credentials Binding (credentials)  (§3.4)
# - client Docker pour piloter le Docker de l'hôte (socket monté au lancement) (§3.4)
# - Node.js 22 pour npm ci, Prisma, tests et analyse SonarQube (§3.5)
FROM jenkins/jenkins:lts-jdk21

USER root
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker

COPY --from=node:22.23.4-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22.23.4-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

USER jenkins
RUN jenkins-plugin-cli --plugins \
    git \
    workflow-aggregator \
    sonar \
    credentials-binding
