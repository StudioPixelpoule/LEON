#!/bin/bash

# ============================================
# Script de lancement LEON
# Double-cliquez sur ce fichier pour lancer l'application
# ============================================

# Aller dans le dossier du projet
cd "$(dirname "$0")"

echo "🎬 Démarrage de LEON..."
echo ""

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "Installez-le depuis : https://nodejs.org"
    read -p "Appuyez sur Entrée pour quitter..."
    exit 1
fi

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

# Vérifier que pCloud Drive est monté
if [ ! -d "/Users/lionelvernay/pCloud Drive/films" ]; then
    echo "⚠️  Attention : pCloud Drive n'est pas accessible"
    echo "Lancez l'application pCloud Drive avant de continuer"
    read -p "Appuyez sur Entrée pour continuer quand même..."
fi

# Lancer l'application
echo "🚀 Lancement de LEON..."
echo ""
echo "✅ L'application sera accessible sur : http://localhost:3000"
echo "✅ Page d'administration : http://localhost:3000/admin"
echo ""
echo "⚠️  Pour arrêter l'application : Fermez cette fenêtre ou appuyez sur Ctrl+C"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev

# Si l'application s'arrête
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👋 LEON s'est arrêté"
read -p "Appuyez sur Entrée pour quitter..."




