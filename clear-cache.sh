#!/bin/bash
# Script pour nettoyer le cache HLS et redémarrer le serveur

echo "🧹 Nettoyage du cache HLS..."
rm -rf /tmp/leon-hls/*
echo "✅ Cache nettoyé"

echo "🔄 Redémarrage du serveur Next.js..."
pkill -9 node
sleep 2
cd /Users/lionelvernay/Documents/Cursor/LEON
npm run dev


