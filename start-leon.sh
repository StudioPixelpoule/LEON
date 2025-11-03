#!/bin/bash

# Script de lancement LEON avec ouverture automatique du navigateur

echo "🚀 Démarrage de LEON..."

# Nettoyer les anciens processus Node.js
killall node 2>/dev/null
sleep 1

# Créer un fichier temporaire pour capturer la sortie
TEMP_LOG=$(mktemp)

# Démarrer Next.js et capturer la sortie
npm run dev:simple > "$TEMP_LOG" 2>&1 &
NEXT_PID=$!

echo "⏳ Attente du serveur Next.js..."

# Attendre que le serveur soit prêt (maximum 30 secondes)
MAX_WAIT=30
WAIT_COUNT=0
URL=""

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  # Chercher l'URL dans les logs
  if [ -f "$TEMP_LOG" ]; then
    URL=$(grep -oE "http://localhost:[0-9]+" "$TEMP_LOG" | head -1)
    
    if [ ! -z "$URL" ]; then
      # URL trouvée, vérifier que le serveur répond
      if curl -s "$URL" > /dev/null 2>&1; then
        echo ""
        echo "✅ Serveur prêt !"
        break
      fi
    fi
  fi
  
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
  echo -n "."
done

echo ""

if [ -z "$URL" ]; then
  echo "❌ Impossible de démarrer le serveur (timeout après ${MAX_WAIT}s)"
  echo ""
  echo "📋 Logs du serveur :"
  cat "$TEMP_LOG"
  rm "$TEMP_LOG"
  exit 1
fi

# Ouvrir le navigateur
echo "🌐 Ouverture de $URL"
sleep 1
open "$URL"

echo ""
echo "✨ LEON est lancé !"
echo "📍 URL: $URL"
echo ""
echo "Pour arrêter: Ctrl+C ou 'npm run stop'"
echo ""

# Afficher les logs en temps réel
tail -f "$TEMP_LOG" &
TAIL_PID=$!

# Nettoyer à la sortie
trap "kill $TAIL_PID 2>/dev/null; rm -f $TEMP_LOG; exit" INT TERM EXIT

# Attendre que le processus Next.js se termine
wait $NEXT_PID
