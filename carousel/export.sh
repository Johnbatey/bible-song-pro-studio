#!/usr/bin/env bash
# Render the five carousel slides to PNG at 1080 × 1350 (4:5).
# Supersampled at 2× then downscaled, so Geist Mono's 9px labels stay clean.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${BSP_PORT:-8791}"
case "$PORT" in ''|0|*[!0-9]*) PORT=8791;; esac
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
NAMES=("01-free-church-software" "02-you-speak" "03-no-typing" "04-three-screens" "05-phone-remote" "06-greek" "07-comment-bsp")

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null || true' EXIT
  sleep 1.5
fi

mkdir -p export
for i in 1 2 3 4 5 6 7; do
  name="${NAMES[$((i-1))]}"
  profile=$(mktemp -d)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=1080,1350 \
    --virtual-time-budget=4000 --user-data-dir="$profile" \
    --screenshot="export/$name@2x.png" \
    "http://127.0.0.1:$PORT/index.html?slide=$i" >/dev/null 2>&1
  if [ ! -f "export/$name@2x.png" ]; then echo "FAILED: $name"; exit 1; fi
  sips -Z 1350 "export/$name@2x.png" --out "export/$name.png" >/dev/null
  rm -f "export/$name@2x.png"
  echo "export/$name.png  $(sips -g pixelWidth -g pixelHeight "export/$name.png" | tail -2 | awk '{print $2}' | paste -sd'x' -)"
done
