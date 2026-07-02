#!/usr/bin/env bash
# ZeitWerk – Setup-Helfer fuer einen frischen Ubuntu/Debian VPS (z.B. Hostinger).
# Installiert Node.js, richtet einen Service-User ein, installiert die App
# unter /opt/zeitwerk und startet sie als systemd-Service.
#
# Als root ausfuehren:  sudo bash deploy/setup.sh
# (Nginx + HTTPS werden separat eingerichtet – siehe DEPLOY.md, Schritt 5-6.)

set -euo pipefail

APP_DIR="/opt/zeitwerk"
APP_USER="zeitwerk"
NODE_MAJOR="22"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root ausfuehren:  sudo bash deploy/setup.sh" >&2
  exit 1
fi

echo "==> Node.js ${NODE_MAJOR}.x installieren (falls noetig)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node --version

echo "==> Service-User '${APP_USER}' anlegen (falls noetig)"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"

echo "==> Code nach ${APP_DIR} kopieren"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$APP_DIR"
cp -r "$SRC_DIR/server" "$SRC_DIR/public" "$SRC_DIR/package.json" "$SRC_DIR/package-lock.json" "$APP_DIR/"

echo "==> Abhaengigkeiten installieren"
cd "$APP_DIR"
npm ci --omit=dev

echo "==> Zufaelliges JWT_SECRET erzeugen"
SECRET="$(openssl rand -hex 32)"

echo "==> systemd-Service einrichten"
sed \
  -e "s|Environment=JWT_SECRET=.*|Environment=JWT_SECRET=${SECRET}|" \
  "$SRC_DIR/deploy/zeitwerk.service" > /etc/systemd/system/zeitwerk.service

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
systemctl daemon-reload
systemctl enable --now zeitwerk

echo
echo "==> Fertig! ZeitWerk laeuft lokal auf http://127.0.0.1:3000"
echo "    Status:  systemctl status zeitwerk"
echo "    Logs:    journalctl -u zeitwerk -f"
echo
echo "    Naechster Schritt: Nginx + HTTPS einrichten (siehe DEPLOY.md, Schritt 5-6)."
