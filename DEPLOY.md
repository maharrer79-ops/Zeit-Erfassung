# ZeitWerk auf einem Hostinger VPS betreiben

Diese Anleitung bringt ZeitWerk auf einem Hostinger VPS (Ubuntu/Debian) dauerhaft
und über **HTTPS** ins Netz. Es gibt zwei Wege:

- **Weg A – ohne Docker** (Node + systemd + Nginx): schlank, empfohlen für „nebenbei".
- **Weg B – mit Docker** (docker compose + Nginx): alles gekapselt in einem Container.

Beide Wege nutzen am Ende **Nginx als Reverse Proxy + Let's Encrypt** für HTTPS.

---

## Voraussetzungen (einmalig)

1. Ein Hostinger VPS mit Ubuntu 22.04/24.04 (kleinster KVM-Plan reicht).
2. Eine Domain oder Subdomain, deren **A-Record auf die VPS-IP** zeigt, z. B.
   `zeit.deinedomain.de → 203.0.113.10`. (Bei Hostinger im hPanel unter DNS.)
3. SSH-Zugang zum VPS (`ssh root@DEINE-IP`).

> **Warum HTTPS Pflicht ist:** Beim Login gehen E-Mail und Passwort übers Netz.
> Ohne HTTPS wären die im Klartext lesbar. Let's Encrypt ist kostenlos.

---

## Weg A – ohne Docker (empfohlen)

### 1. Code auf den VPS holen
```bash
ssh root@DEINE-IP
apt update && apt install -y git
git clone <DEIN-REPO-URL> /root/zeitwerk-src
cd /root/zeitwerk-src
```

### 2. Automatisches Setup ausführen
Das mitgelieferte Skript installiert Node.js, legt einen Service-User an,
kopiert die App nach `/opt/zeitwerk`, erzeugt ein zufälliges `JWT_SECRET`
und startet alles als Autostart-Service:
```bash
sudo bash deploy/setup.sh
```
Danach läuft die App lokal auf `http://127.0.0.1:3000`. Prüfen:
```bash
systemctl status zeitwerk
curl -s http://127.0.0.1:3000/api/health   # -> {"status":"ok"}
```

> Lieber pm2 statt systemd? Dann statt des Skripts:
> `npm ci --omit=dev && npm i -g pm2 && pm2 start deploy/ecosystem.config.cjs`
> (vorher `JWT_SECRET` in `deploy/ecosystem.config.cjs` setzen).

Weiter mit **Schritt 5 (Nginx)**.

---

## Weg B – mit Docker

### 3. Docker installieren
```bash
ssh root@DEINE-IP
curl -fsSL https://get.docker.com | sh
```

### 4. Starten
```bash
git clone <DEIN-REPO-URL> /opt/zeitwerk && cd /opt/zeitwerk
printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" > .env
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health   # -> {"status":"ok"}
```
Die SQLite-Daten liegen im Docker-Volume `zeitwerk_data` und überleben Updates.

Weiter mit **Schritt 5 (Nginx)**.

---

## Schritt 5 – Nginx als Reverse Proxy

```bash
apt install -y nginx
# mitgelieferte Config kopieren
cp /opt/zeitwerk/deploy/nginx.conf /etc/nginx/sites-available/zeitwerk   # Weg B
# bzw. bei Weg A:  cp /root/zeitwerk-src/deploy/nginx.conf /etc/nginx/sites-available/zeitwerk
```
Jetzt in der Datei `server_name` auf deine Domain ändern:
```bash
nano /etc/nginx/sites-available/zeitwerk    # zeit.deinedomain.de eintragen
```
Aktivieren:
```bash
ln -sf /etc/nginx/sites-available/zeitwerk /etc/nginx/sites-enabled/zeitwerk
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```
Test über HTTP (noch ohne Zertifikat): `http://zeit.deinedomain.de` sollte die
Landingpage zeigen.

---

## Schritt 6 – HTTPS mit Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d zeit.deinedomain.de
```
Certbot holt das Zertifikat, trägt es in die Nginx-Config ein und richtet die
automatische Verlängerung ein. Danach ist die App unter
**`https://zeit.deinedomain.de`** erreichbar. 🎉

> Weil hinter HTTPS betrieben, sind `secure`-Cookies aktiv – das passt, weil die
> App mit `NODE_ENV=production` läuft (Weg A: im Service gesetzt; Weg B: im Compose).

---

## Firewall (empfohlen)
```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```
Port 3000 bleibt **nicht** von außen offen – nur Nginx (80/443) ist erreichbar,
die Node-App hört lokal auf 127.0.0.1.

---

## Updates einspielen

**Weg A:**
```bash
cd /root/zeitwerk-src && git pull
sudo bash deploy/setup.sh        # kopiert neuen Code & startet Service neu
```
**Weg B:**
```bash
cd /opt/zeitwerk && git pull
docker compose up -d --build
```

## Datensicherung
Die gesamte Datenbank ist **eine Datei**:
- Weg A: `/opt/zeitwerk/data.sqlite`
- Weg B: Docker-Volume `zeitwerk_data` (`docker run --rm -v zeitwerk_data:/d -v $PWD:/b busybox cp /d/data.sqlite /b/`)

Einfach regelmäßig wegkopieren (z. B. per Cronjob) – fertig.

---

## Kurz-Checkliste
- [ ] (Sub-)Domain-A-Record zeigt auf die VPS-IP
- [ ] App läuft lokal auf Port 3000 (`/api/health` = ok)
- [ ] `JWT_SECRET` ist ein eigener Zufallswert (nicht der Standard)
- [ ] Nginx leitet die Domain auf 127.0.0.1:3000
- [ ] Certbot hat HTTPS aktiviert
- [ ] Firewall offen nur für SSH + Nginx
