# Image Jenkins du projet SouverainRecrut (§3.4)
# - plugins Git, Pipeline, SonarQube + Credentials Binding (credentials)
# - client Docker pour piloter le Docker de l'hôte (socket monté au lancement)
FROM jenkins/jenkins:lts-jdk21

USER root
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker

USER jenkins
RUN jenkins-plugin-cli --plugins \
    git \
    workflow-aggregator \
    sonar \
    credentials-binding
