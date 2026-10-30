/** Les dates arrivent en Date (PGlite) ou en chaîne (Neon) : on normalise en AAAA-MM-JJ. */
export function isoJour(d: unknown): string {
  if (!d) return "";
  if (d instanceof Date) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), j = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${j}`;
  }
  return String(d).slice(0, 10);
}

export function dateFr(d: unknown): string {
  const s = isoJour(d);
  if (!s) return "";
  const [y, m, j] = s.split("-");
  return `${j}/${m}/${y}`;
}

export function periode(debut: unknown, fin: unknown): string {
  const a = dateFr(debut), b = dateFr(fin);
  if (a && b && a !== b) return `du ${a} au ${b}`;
  return a || b;
}

/** Couleur d'un niveau selon sa position dans l'échelle de l'épreuve (du plus faible au meilleur). */
export function couleurNiveau(index: number, total: number): { fond: string; texte: string } {
  const palette = [
    { fond: "#8a8f8c", texte: "#fff" }, // faible
    { fond: "#c9772f", texte: "#fff" },
    { fond: "#2f7d5b", texte: "#fff" },
    { fond: "#b8892a", texte: "#fff" }, // meilleur : or
  ];
  if (total <= 1) return palette[2];
  const r = index / (total - 1);
  return palette[Math.min(palette.length - 1, Math.round(r * (palette.length - 1)))];
}
