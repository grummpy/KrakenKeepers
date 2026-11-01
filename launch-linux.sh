#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to launch Kraken Keepers."
  echo "Install it from your package manager (for example: sudo apt install python3) or from https://www.python.org/downloads/ and try again."
  read -r -p "Press Enter to close..." _
  exit 1
fi
exec python3 server.py
