#!/bin/sh
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 4173
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server 4173
else
  echo "Python não foi encontrado."
  exit 1
fi
