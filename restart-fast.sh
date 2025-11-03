#!/bin/bash
# Script pour nettoyer cache + redémarrer rapidement

echo "🧹 Nettoyage cache HLS..."
rm -rf /tmp/leon-hls/*

echo "🔄 Redémarrage serveur..."
pkill -9 node
sleep 1

cd /Users/lionelvernay/Documents/Cursor/LEON
echo "🚀 Démarrage..."
npm run dev


