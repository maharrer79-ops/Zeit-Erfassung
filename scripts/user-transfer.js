// ZeitWerk – Nutzerdaten exportieren / importieren
//
// Zweck: die Zeiten + Projekte EINES Nutzers von einer Datenbank in eine andere
// (z.B. auf einen neuen Server) uebertragen. Passwoerter werden NICHT exportiert.
//
// Verwendung:
//   Auf dem ALTEN Server (Daten herausholen):
//     DB_PATH=/pfad/zu/data.sqlite node scripts/user-transfer.js export deine@mail.at [export.json]
//
//   Datei (export.json) auf den NEUEN Server kopieren, dort MUSS der Ziel-Account
//   bereits registriert sein (einmal normal in der App registrieren). Dann:
//     DB_PATH=/pfad/zu/data.sqlite node scripts/user-transfer.js import export.json ziel@mail.at
//
// Der Import ist additiv (fuegt hinzu, ueberschreibt nichts). Zweimaliger Import
// wuerde die Eintraege doppelt anlegen.

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data.sqlite');

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  return db;
}

function die(msg) {
  console.error('FEHLER: ' + msg);
  process.exit(1);
}

// ---------- Export ----------
function doExport(email, outFile) {
  if (!email) die('Bitte E-Mail angeben: node scripts/user-transfer.js export <email> [datei.json]');
  const db = openDb();
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
  if (!user) die(`Kein Nutzer mit E-Mail "${email}" gefunden (DB: ${DB_PATH}).`);

  const projects = db.prepare('SELECT id, name, color, created_at FROM projects WHERE user_id = ? ORDER BY id').all(user.id);
  const entries = db.prepare(
    `SELECT id, project_id, description, kind_code, kind_label, entry_type, punch_dir, start_ts, end_ts, created_at
     FROM entries WHERE user_id = ? ORDER BY id`
  ).all(user.id);

  const payload = {
    format: 'zeitwerk-user-export',
    version: 1,
    exported_at: new Date().toISOString(),
    source: { name: user.name, email: user.email },
    projects,
    entries,
  };

  const file = outFile || `zeitwerk-export-${email.replace(/[^a-z0-9]+/gi, '_')}.json`;
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`✔ Export erstellt: ${file}`);
  console.log(`  Nutzer:   ${user.name} <${user.email}>`);
  console.log(`  Projekte: ${projects.length}`);
  console.log(`  Eintraege:${entries.length}`);
  console.log('\nDiese Datei auf den neuen Server kopieren und dort importieren.');
  db.close();
}

// ---------- Import ----------
function doImport(file, targetEmail) {
  if (!file || !targetEmail) die('Verwendung: node scripts/user-transfer.js import <datei.json> <ziel-email>');

  let payload;
  try {
    payload = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    die(`Datei "${file}" konnte nicht gelesen/geparst werden: ${e.message}`);
  }
  if (payload.format !== 'zeitwerk-user-export') die('Falsches Dateiformat (kein ZeitWerk-Export).');

  const db = openDb();
  const target = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(targetEmail);
  if (!target) {
    die(`Ziel-Nutzer "${targetEmail}" existiert nicht (DB: ${DB_PATH}).\n` +
        '       Bitte diesen Account zuerst normal in der App registrieren und dann erneut importieren.');
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE user_id = ?').get(target.id).n;
  if (existing > 0) {
    console.warn(`⚠ Hinweis: Ziel-Account hat bereits ${existing} Eintraege. Der Import fuegt weitere hinzu (keine Zusammenfuehrung/Dedup).`);
  }

  const insProject = db.prepare('INSERT INTO projects (user_id, name, color, created_at) VALUES (?, ?, ?, ?)');
  const insEntry = db.prepare(
    `INSERT INTO entries (user_id, project_id, description, kind_code, kind_label, entry_type, punch_dir, start_ts, end_ts, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    const projMap = new Map(); // alte Projekt-ID -> neue Projekt-ID
    for (const p of payload.projects || []) {
      const info = insProject.run(target.id, p.name, p.color || '#4f46e5', p.created_at || new Date().toISOString());
      projMap.set(p.id, info.lastInsertRowid);
    }
    let nEntries = 0;
    for (const e of payload.entries || []) {
      const newProjectId = e.project_id != null ? (projMap.get(e.project_id) ?? null) : null;
      insEntry.run(
        target.id, newProjectId, e.description || '', e.kind_code || '0010',
        e.kind_label || 'Kommen/Gehen', e.entry_type || 'interval', e.punch_dir ?? null,
        e.start_ts, e.end_ts ?? null, e.created_at || new Date().toISOString()
      );
      nEntries++;
    }
    return { nProjects: projMap.size, nEntries };
  });

  const res = tx();
  console.log(`✔ Import abgeschlossen fuer ${target.name} <${target.email}>`);
  console.log(`  Projekte importiert:  ${res.nProjects}`);
  console.log(`  Eintraege importiert: ${res.nEntries}`);
  db.close();
}

// ---------- CLI ----------
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'export') doExport(a, b);
else if (cmd === 'import') doImport(a, b);
else {
  console.log('ZeitWerk Nutzer-Transfer\n');
  console.log('  Export:  DB_PATH=... node scripts/user-transfer.js export <email> [datei.json]');
  console.log('  Import:  DB_PATH=... node scripts/user-transfer.js import <datei.json> <ziel-email>');
  process.exit(cmd ? 1 : 0);
}
