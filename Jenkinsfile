// Pipeline CI - SouverainRecrut Backend (§3.5)
// checkout Dev -> dépendances -> Prisma -> tests -> SonarQube + contrôle du
// Quality Gate -> build de l'image -> scan Trivy -> publication sur Docker Hub.
// Chaque étape doit réussir : en cas d'échec le pipeline s'arrête
// et l'image n'est PAS publiée.
pipeline {
    agent any

    options {
        skipDefaultCheckout()
    }

    environment {
        IMAGE_NAME = 'yanisght/souverainrecrut-backend'
    }

    stages {
        stage('Checkout Dev') {
            steps {
                // Le job est configuré sur la branche */Dev du fork
                checkout scm
                script {
                    def version = sh(script: "node -p \"require('./backend/package.json').version\"", returnStdout: true).trim()
                    def commit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    // Tag traçable : version applicative + identifiant de commit
                    env.IMAGE_TAG = "${version}-${commit}"
                }
                echo "Image à produire : ${IMAGE_NAME}:${IMAGE_TAG}"
            }
        }

        stage('Installation des dépendances') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                }
            }
        }

        stage('Génération Prisma') {
            steps {
                dir('backend') {
                    sh 'npx prisma generate'
                }
            }
        }

        stage('Tests') {
            steps {
                dir('backend') {
                    // Produit aussi coverage/lcov.info pour SonarQube
                    sh 'npm run test:coverage'
                }
            }
        }

        stage('Analyse SonarQube + Quality Gate') {
            steps {
                dir('backend') {
                    // Serveur et token fournis par Jenkins (serveur "sonarqube",
                    // credential "sonarqube-token") : aucun secret dans le dépôt.
                    // sonar.qualitygate.wait : le scanner attend le verdict du
                    // Quality Gate et échoue s'il n'est pas PASSED.
                    withSonarQubeEnv('sonarqube') {
                        sh '''
                            npx --yes @sonar/scan \
                              -Dsonar.host.url="$SONAR_HOST_URL" \
                              -Dsonar.token="$SONAR_AUTH_TOKEN" \
                              -Dsonar.qualitygate.wait=true \
                              -Dsonar.qualitygate.timeout=300
                        '''
                    }
                }
            }
        }

        stage('Build image Docker') {
            steps {
                dir('backend') {
                    sh 'docker build -t "$IMAGE_NAME:$IMAGE_TAG" .'
                }
            }
        }

        stage('Scan Trivy') {
            steps {
                // Seuil retenu : aucune vulnérabilité CRITICAL (code de sortie 1 sinon)
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v trivy_cache:/root/.cache/ \
                      aquasec/trivy:0.76.2 image \
                      --scanners vuln --severity CRITICAL --exit-code 1 \
                      "$IMAGE_NAME:$IMAGE_TAG"
                '''
            }
        }

        stage('Publication Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_TOKEN')]) {
                    sh '''
                        echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
                        docker push "$IMAGE_NAME:$IMAGE_TAG"
                        docker logout
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Image publiée : ${IMAGE_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo 'Pipeline en échec : image non publiée.'
        }
    }
}
