// Wandelt Eintraege in gearbeitete Zeitbloecke um:
//  - Intervall-Eintraege (Von–Bis) und gepaarte Kommen/Gehen-Stempel = Anwesenheit
//  - Pausen (Typ 'pause') werden von der Anwesenheit abgezogen
// Rueckgabe: Array von { start: Date, end: Date, label: string }
window.computeBlocks = function (entries) {
  const presence = [];

  // Anwesenheit aus Intervall-Eintraegen (ohne Pausen)
  for (const e of entries) {
    if (e.entry_type === 'punch' || e.entry_type === 'pause') continue;
    if (e.end_ts) {
      presence.push({
        start: new Date(e.start_ts),
        end: new Date(e.end_ts),
        label: e.description || e.kind_label || e.project_name || '',
      });
    }
  }

  // Anwesenheit aus Kommen/Gehen-Stempeln
  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen' && open) {
      presence.push({ start: new Date(open.start_ts), end: new Date(p.start_ts), label: open.description || 'Anwesend' });
      open = null;
    }
  }

  // Pausen
  const pauses = window.computePauses(entries);

  // Pausen aus der Anwesenheit herausschneiden -> Arbeitsbloecke
  const blocks = [];
  for (const pr of presence) {
    let segments = [{ start: pr.start, end: pr.end }];
    for (const pz of pauses) {
      const next = [];
      for (const seg of segments) {
        if (pz.end <= seg.start || pz.start >= seg.end) { next.push(seg); continue; }
        if (pz.start > seg.start) next.push({ start: seg.start, end: new Date(Math.min(+pz.start, +seg.end)) });
        if (pz.end < seg.end) next.push({ start: new Date(Math.max(+pz.end, +seg.start)), end: seg.end });
      }
      segments = next;
    }
    for (const seg of segments) if (seg.end > seg.start) blocks.push({ start: seg.start, end: seg.end, label: pr.label });
  }
  return blocks;
};

// Alle Pausen als { start: Date, end: Date }:
//  - ausdrueckliche Pause-Eintraege
//  - Luecken zwischen aufeinanderfolgenden Kommen/Gehen-Paaren AM SELBEN TAG
//    (also Gehen -> spaeter wieder Kommen). Das letzte Gehen eines Tages ist
//    Feierabend und zaehlt nicht als Pause.
window.computePauses = function (entries) {
  const pauses = entries
    .filter((e) => e.entry_type === 'pause' && e.end_ts)
    .map((e) => ({ start: new Date(e.start_ts), end: new Date(e.end_ts) }));

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Jede Folge "Gehen -> danach Kommen" am selben Tag ist eine Pause.
  // Das zweite Kommen muss NICHT abgeschlossen sein (auch waehrend man eingestempelt ist).
  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  for (let i = 1; i < punches.length; i++) {
    const prev = punches[i - 1];
    const cur = punches[i];
    if (prev.punch_dir === 'gehen' && cur.punch_dir === 'kommen') {
      const gapStart = new Date(prev.start_ts);
      const gapEnd = new Date(cur.start_ts);
      if (gapEnd > gapStart && sameDay(gapStart, gapEnd)) {
        pauses.push({ start: gapStart, end: gapEnd });
      }
    }
  }
  return pauses;
};
