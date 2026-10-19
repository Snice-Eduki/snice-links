#!/usr/bin/env bash
# Putz-Duell auf dem Heimserver einrichten. Erkennt selbst, ob Docker da ist,
# sonst läuft die App mit Node.js als systemd-Dienst. Aufruf: sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8470}"

say() { printf '\n==> %s\n' "$*"; }
ip_hint() { hostname -I 2>/dev/null | awk '{print $1}'; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo starten:  sudo bash install.sh" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  say "Docker gefunden, starte Putz-Duell als Container"
  docker compose up -d --build
  sleep 2
  if curl -fs "http://localhost:${PORT}/api/state" >/dev/null; then
    say "Läuft. Auf dem Handy öffnen:  http://$(ip_hint):${PORT}"
  else
    say "Container gestartet, antwortet aber noch nicht. Log:  docker logs putz-duell"
  fi
  exit 0
fi

say "Kein Docker, richte systemd-Dienst mit Node.js ein"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  say "Installiere Node.js"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq nodejs >/dev/null
  else
    echo "Node.js (ab 18) fehlt und apt-get gibt es hier nicht. Bitte Node.js von Hand installieren." >&2
    exit 1
  fi
  if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
    say "Das Node.js aus den Paketquellen ist zu alt, hole Version 22 von nodesource"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs >/dev/null
  fi
fi

DEST=/opt/putz-duell
id -u putzduell >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin putzduell
mkdir -p "$DEST"
cp -r server.js public "$DEST"/
mkdir -p "$DEST/data"
chown -R putzduell:putzduell "$DEST"

NODE_BIN="$(command -v node)"
sed "s#/usr/bin/node#${NODE_BIN}#; s#PORT=8470#PORT=${PORT}#" putz-duell.service > /etc/systemd/system/putz-duell.service
systemctl daemon-reload
systemctl enable --now putz-duell
systemctl restart putz-duell
sleep 2
if systemctl is-active --quiet putz-duell; then
  say "Läuft. Auf dem Handy öffnen:  http://$(ip_hint):${PORT}"
  echo "Status:  systemctl status putz-duell     Log:  journalctl -u putz-duell -f"
else
  say "Dienst startet nicht. Log ansehen:  journalctl -u putz-duell -n 50"
  exit 1
fi
