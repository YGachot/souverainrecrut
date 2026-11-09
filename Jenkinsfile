// Pipeline Jenkins - SouverainRecrut Backend
// §3.4 : vérification de l'accès au dépôt GitHub et à Docker.
// Les étapes de la chaîne CI seront ajoutées au §3.5.
pipeline {
    agent any

    stages {
        stage('Vérification de l\'environnement') {
            steps {
                sh 'git log -1 --oneline'
                sh 'docker version'
            }
        }
    }
}
