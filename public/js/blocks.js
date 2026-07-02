// Wandelt Eintraege in gearbeitete Zeitbloecke um:
//  - Intervall-Eintraege (Von–Bis) direkt
//  - Kommen/Gehen-Stempel werden paarweise verbunden
// Rueckgabe: Array von { start: Date, end: Date }
window.computeBlocks = function (entries) {
  const blocks = [];

  // 1) Intervall-Eintraege (abgeschlossen)
  for (const e of entries) {
    if (e.entry_type !== 'punch' && e.end_ts) {
      blocks.push({ start: new Date(e.start_ts), end: new Date(e.end_ts) });
    }
  }

  // 2) Stempel paaren (Kommen -> Gehen), zeitlich aufsteigend
  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));

  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') {
      open = p; // ein neues Kommen ersetzt ein evtl. offenes (unvollstaendiges)
    } else if (p.punch_dir === 'gehen' && open) {
      blocks.push({ start: new Date(open.start_ts), end: new Date(p.start_ts) });
      open = null;
    }
  }
  // Ein uebrig gebliebenes "Kommen" = aktuell anwesend -> wird nicht mitgezaehlt
  return blocks;
};
