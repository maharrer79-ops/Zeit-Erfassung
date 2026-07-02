# ZeitWerk – Zeiterfassung fürs Team

Eine schlanke Zeiterfassung mit **getrennten Accounts**: Du und deine Kolleg:innen
meldet euch mit eigenen Zugängen an, jede:r sieht nur die eigenen Zeiten. Dazu gibt
es eine **Landingpage** und die **App**.

## Funktionen

- 👥 **Getrennte Accounts** – Registrierung & Login pro Person, sichere Passwörter (bcrypt), Session per Cookie (JWT)
- ⏱️ **Stempeluhr** – Kommen und Gehen als getrennte Stempel (eigene Positionen), Live-Anzeige der Anwesenheit; Stempel lassen sich nachtragen. Kommen→Gehen wird automatisch zu Arbeitszeit gepaart
- ✏️ **Manuelle Einträge** – Zeiten nachtragen und jederzeit bearbeiten/löschen
- 🏷️ **Buchungsarten** – manuelle Einträge einer Kategorie zuordnen (z. B. Tarifurlaub, Dienstreise, mobiles Arbeiten …); beim Stempeln immer „Kommen/Gehen"
- 📁 **Projekte** – Zeiten Projekten/Kunden zuordnen (mit Farbe)
- 📊 **Auswertung** – Stunden für Heute, diese Woche und Gesamt
- 📤 **CSV-Export** – Zeiten für Excel / die Abrechnung exportieren
- 🔒 **Account-Limit** – maximale Zahl an Registrierungen begrenzbar (Standard 30, per `MAX_USERS`)

## Technik

- **Backend:** Node.js + Express, SQLite (better-sqlite3) – zero-config, eine Datei
- **Auth:** JWT im httpOnly-Cookie, Passwörter mit bcrypt gehasht
- **Frontend:** reines HTML/CSS/JS, kein Build-Schritt

## Lokal starten

```bash
npm install
cp .env.example .env      # optional – Standardwerte funktionieren auch
npm start
```

Dann im Browser öffnen: <http://localhost:3000>

- `/`      → Landingpage (Registrieren / Anmelden)
- `/app`   → die Zeiterfassungs-App (nach dem Login)

## Ablauf im Team

1. Jede:r öffnet die Seite und erstellt über **„Kostenlos starten"** einen eigenen Account.
2. Alle arbeiten mit denselben Server-Daten, aber getrennt – niemand sieht die Zeiten der anderen.
3. Zum Teilen im Team einfach den Server auf einem erreichbaren Host deployen (siehe unten).

## Deployment

Die App braucht nur Node.js und einen Schreibpfad für die SQLite-Datei. Geeignet sind
z. B. Render, Railway, Fly.io oder ein kleiner VPS.

Wichtige Umgebungsvariablen (siehe `.env.example`):

| Variable     | Bedeutung                                                        |
|--------------|------------------------------------------------------------------|
| `PORT`       | Port des Servers (Standard 3000)                                 |
| `JWT_SECRET` | **In Produktion zwingend** durch langen Zufallswert ersetzen     |
| `DB_PATH`    | Pfad zur SQLite-Datei (auf persistentem Volume ablegen)          |
| `NODE_ENV`   | `production` setzen, wenn hinter HTTPS betrieben (secure Cookies) |

## Projektstruktur

```
server/
  index.js          Express-Server & Routen-Einbindung
  db.js             SQLite-Verbindung & Schema
  auth.js           JWT/Cookie-Helfer & Auth-Middleware
  routes/
    auth.js         Registrierung, Login, Logout, /me
    projects.js     Projekte CRUD
    entries.js      Zeiteinträge, Timer, CSV-Export
public/
  index.html        Landingpage
  app.html          App
  css/styles.css
  js/landing.js     Auth-Modal
  js/app.js         App-Logik
```
