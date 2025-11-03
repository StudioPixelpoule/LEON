#!/bin/bash
# Script pour tuer TOUS les processus Node et redémarrer proprement

echo "🔍 Recherche de tous les processus Node..."
ps aux | grep node | grep -v grep

echo ""
echo "💀 Arrêt de TOUS les processus Node..."
pkill -9 node 2>/dev/null || true
pkill -9 next 2>/dev/null || true

echo ""
echo "🧹 Nettoyage du cache HLS..."
rm -rf /tmp/leon-hls/* 2>/dev/null || true

echo ""
echo "🔍 Vérification que tout est bien arrêté..."
sleep 2
REMAINING=$(ps aux | grep node | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
  echo "⚠️ Il reste des processus Node :"
  ps aux | grep node | grep -v grep
else
  echo "✅ Tous les processus Node sont arrêtés"
fi

echo ""
echo "🚀 Démarrage du serveur Next.js sur le port 3000..."
cd /Users/lionelvernay/Documents/Cursor/LEON
npm run dev


