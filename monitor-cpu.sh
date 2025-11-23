#!/bin/bash
# Script pour surveiller l'utilisation CPU de FFmpeg

while true; do
  FFMPEG_PID=$(ps aux | grep "[f]fmpeg.*hls" | awk '{print $2}' | head -1)
  if [ ! -z "$FFMPEG_PID" ]; then
    CPU=$(ps aux | grep "$FFMPEG_PID" | grep -v grep | awk '{print $3}')
    echo "🎬 FFmpeg PID: $FFMPEG_PID | CPU: ${CPU}%"
  else
    echo "⏸️  Pas de transcodage en cours"
  fi
  sleep 2
done
