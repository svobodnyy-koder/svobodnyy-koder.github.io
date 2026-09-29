#!/bin/zsh
set -e
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Python não foi encontrado. Instale pelo site python.org ou Homebrew."
  exit 1
fi

PORT=4173
URL="http://localhost:${PORT}"
echo "Neurodeck disponível em ${URL}"

# Abre o navegador padrão, se o comando existir.
if command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
fi

exec "$PYTHON" -m http.server "$PORT"
