#!/bin/bash
# Nettoyage COMPLET : cache Next.js + HLS + node_modules/.cache

echo "💀 Arrêt de tous les processus Node..."
pkill -9 node 2>/dev/null || true
sleep 2

echo "🧹 Nettoyage cache Next.js..."
rm -rf .next

echo "🧹 Nettoyage cache HLS..."
rm -rf /tmp/leon-hls/*

echo "🧹 Nettoyage cache Node..."
rm -rf node_modules/.cache 2>/dev/null || true

echo "✅ Nettoyage terminé !"
echo ""
echo "🚀 Redémarrage..."
npm run dev

