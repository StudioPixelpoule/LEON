#!/bin/bash
# Force un rechargement complet en supprimant tout le cache

echo "💀 Arrêt du serveur..."
pkill -9 node

echo "🧹 Nettoyage du cache Next.js..."
rm -rf .next

echo "🧹 Nettoyage du cache HLS..."
rm -rf /tmp/leon-hls/*

echo "✅ Nettoyage terminé !"
echo ""
echo "🚀 Redémarrage du serveur..."
npm run dev


