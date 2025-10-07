#!/bin/bash

# ============================================
# LEON - Lanceur d'Application macOS
# ============================================
# Double-cliquez pour lancer LEON automatiquement

PROJECT_PATH="/Users/lionelvernay/Documents/Cursor/LEON"
PORT=3000

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🎬  Lancement de LEON  🎬             ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Naviguer vers le projet
cd "$PROJECT_PATH" || exit 1

# Vérifier si Next.js tourne déjà
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ LEON est déjà en cours d'exécution${NC}"
    echo -e "Ouverture du navigateur..."
    open "http://localhost:$PORT"
    exit 0
fi

# Lancer Next.js en arrière-plan
echo -e "${GREEN}🚀 Démarrage du serveur LEON...${NC}"
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# Attendre que le serveur soit prêt
echo -e "${GREEN}⏳ Attente du serveur...${NC}"
for i in {1..30}; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Serveur prêt !${NC}"
        echo -e "${GREEN}🌐 Ouverture de LEON dans le navigateur...${NC}"
        sleep 1
        open "http://localhost:$PORT"
        echo ""
        echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║  LEON est maintenant accessible !        ║${NC}"
        echo -e "${BLUE}║  URL: http://localhost:$PORT              ║${NC}"
        echo -e "${BLUE}║                                           ║${NC}"
        echo -e "${BLUE}║  Pour arrêter LEON :                      ║${NC}"
        echo -e "${BLUE}║  Fermez cette fenêtre                     ║${NC}"
        echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
        echo ""
        
        # Garder le terminal ouvert et attendre
        wait $SERVER_PID
        exit 0
    fi
    sleep 1
done

echo "❌ Erreur: Le serveur n'a pas démarré"
exit 1




