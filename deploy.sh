#!/bin/bash

# Configuration NAS
NAS_USER="pixel_admin"
NAS_HOST="192.168.2.128"
NAS_PATH="/volume1/docker/leon"
REMOTE="$NAS_USER@$NAS_HOST"

# Commande Docker sur Synology (chemin absolu pour éviter les soucis de PATH)
DOCKER_COMPOSE_CMD="sudo /usr/local/bin/docker-compose"
DOCKER_CMD="sudo docker"

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Aide
show_help() {
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  (default)  Sync code and deploy (build & start)"
    echo "  logs       Show live logs from container"
    echo "  status     Show container status and health"
    echo "  stop       Stop the container"
    echo "  restart    Restart the container"
    echo "  gpu        Check GPU access (vainfo) inside container"
    echo ""
}

# Commande par défaut (deploy)
COMMAND=${1:-deploy}

case $COMMAND in
    deploy)
        echo -e "${BLUE}🚀 Déploiement de LEON sur $NAS_HOST...${NC}"
        
        # 1. Vérification du fichier .env local (avertissement)
        if [ ! -f .env ]; then
            echo -e "${RED}⚠️  Attention: Pas de fichier .env local détecté.${NC}"
            echo "Assurez-vous qu'un fichier .env existe sur le NAS dans $NAS_PATH"
        fi

        # 2. Création de l'archive locale
        echo -e "${BLUE}📦 Création de l'archive...${NC}"
        # Exclure les fichiers lourds et inutiles et les warnings tar macos
        export COPYFILE_DISABLE=1
        tar --exclude='node_modules' \
            --exclude='.next' \
            --exclude='.git' \
            --exclude='.env' \
            --exclude='.DS_Store' \
            --exclude='deploy.tar.gz' \
            --no-xattrs \
            -czf deploy.tar.gz .

        # 3. Transfert via SSH Pipe
        echo -e "${BLUE}📡 Envoi de l'archive vers le NAS...${NC}"
        cat deploy.tar.gz | ssh "$REMOTE" "cat > $NAS_PATH/deploy.tar.gz"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Erreur lors du transfert SSH${NC}"
            rm deploy.tar.gz
            exit 1
        fi

        # 4. Décompression, Build et Lancement
        echo -e "${BLUE}🏗️  Décompression et démarrage Docker...${NC}"
        
        # Commande distante avec chemin absolu et sudo
        ssh -t "$REMOTE" "cd $NAS_PATH && \
            tar -xzf deploy.tar.gz && \
            rm deploy.tar.gz && \
            echo 'Lancement de docker-compose (mot de passe sudo requis)...' && \
            $DOCKER_COMPOSE_CMD up -d --build"

        # Nettoyage local
        rm deploy.tar.gz

        echo -e "${GREEN}✅ Déploiement terminé !${NC}"
        echo "L'application sera accessible sur http://$NAS_HOST:3000 dans quelques minutes."
        ;;

    logs)
        echo -e "${BLUE}📋 Logs en direct...${NC}"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_COMPOSE_CMD logs -f"
        ;;

    status)
        echo -e "${BLUE}🔍 Statut du conteneur...${NC}"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_CMD ps | grep leon && echo '' && curl -s http://localhost:3000/api/health | python3 -m json.tool"
        ;;

    stop)
        echo -e "${BLUE}🛑 Arrêt du conteneur...${NC}"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_COMPOSE_CMD down"
        ;;

    restart)
        echo -e "${BLUE}🔄 Redémarrage...${NC}"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_COMPOSE_CMD restart"
        ;;

    gpu)
        echo -e "${BLUE}📺 Vérification Accélération Matérielle (VAAPI)...${NC}"
        echo "Exécution de 'vainfo' dans le conteneur :"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_COMPOSE_CMD exec leon vainfo"
        echo -e "\n${BLUE}Vérification FFmpeg hwaccels :${NC}"
        ssh -t "$REMOTE" "cd $NAS_PATH && $DOCKER_COMPOSE_CMD exec leon ffmpeg -hwaccels"
        ;;

    *)
        show_help
        exit 1
        ;;
esac
