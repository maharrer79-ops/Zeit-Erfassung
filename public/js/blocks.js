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

  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  const pairs = [];
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen' && open) {
      pairs.push({ start: new Date(open.start_ts), end: new Date(p.start_ts) });
      open = null;
    }
  }
  for (let i = 0; i < pairs.length - 1; i++) {
    const gapStart = pairs[i].end;      // ein Gehen
    const gapEnd = pairs[i + 1].start;  // das naechste Kommen
    if (gapEnd > gapStart && sameDay(gapStart, gapEnd)) {
      pauses.push({ start: gapStart, end: gapEnd });
    }
  }
  return pauses;
};
