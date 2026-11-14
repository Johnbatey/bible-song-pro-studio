#!/usr/bin/env bash
# Render the YouTube thumbnail at 1280 × 720 (supersampled 2× then downscaled).
# YouTube's upload limit is 2 MB, so a JPG is written alongside the PNG.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${BSP_PORT:-8792}"
case "$PORT" in ''|0|*[!0-9]*) PORT=8792;; esac
ROOT="$(cd .. && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/thumbnail/index.html"; then
  (cd "$ROOT" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1.6
fi

OUT="youtube-1280x720"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1280,720 \
  --virtual-time-budget=5000 --user-data-dir="$(mktemp -d)" \
  --screenshot="$OUT@2x.png" \
  "http://127.0.0.1:$PORT/thumbnail/index.html" >/dev/null 2>&1

if [ ! -f "$OUT@2x.png" ]; then echo "FAILED: screenshot not written"; exit 1; fi

sips -Z 1280 "$OUT@2x.png" --out "$OUT.png" >/dev/null
sips -s format jpeg -s formatOptions 92 "$OUT.png" --out "$OUT.jpg" >/dev/null
rm -f "$OUT@2x.png"

for f in "$OUT.png" "$OUT.jpg"; do
  echo "$f  $(sips -g pixelWidth -g pixelHeight "$f" | tail -2 | awk '{print $2}' | paste -sd'x' -)  $(du -h "$f" | cut -f1)"
done
