/**
 * Lecture d'un fichier ou d'une liste de mots clés.
 * Accepte : une colonne (un mot clé par ligne) ou deux colonnes « mot clé ; fréquence ».
 * Séparateur détecté : point-virgule (Excel FR), tabulation (copier-coller) ou virgule.
 * Encodage : UTF-8, sinon Windows-1252 (CSV enregistré par Excel sous Windows).
 */

export function decoderFichier(octets: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}

function decouper(ligne: string, sep: string): string[] {
  const cellules: string[] = [];
  let cur = "", guillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (guillemets) {
      if (c === '"' && ligne[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cur += c;
    } else if (c === '"' && cur.trim() === "") { guillemets = true; cur = ""; }
    else if (c === sep) { cellules.push(cur); cur = ""; }
    else cur += c;
  }
  cellules.push(cur);
  return cellules.map((x) => x.trim());
}

const ENTETES = new Set(["mot", "mots", "mot cle", "mots cles", "mot-cle", "mots-cles", "texte", "libelle", "expression", "keyword", "keywords"]);
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type LigneMotCle = { texte: string; usage: number | null };

export function lireMotsCles(contenu: string): LigneMotCle[] {
  const lignes = contenu.replace(/^﻿/, "").split(/\r\n|\n|\r/).filter((l) => l.trim());
  if (!lignes.length) return [];
  const sep = lignes.some((l) => l.includes(";")) ? ";" : lignes.some((l) => l.includes("\t")) ? "\t" : ",";

  const res: LigneMotCle[] = [];
  lignes.forEach((ligne, i) => {
    const c = decouper(ligne, sep).filter((x, j, t) => x !== "" || j < t.length - 1);
    if (!c.length || !c[0]) return;
    if (i === 0 && ENTETES.has(sansAccent(c[0]))) return; // ligne d'en-tête
    const dernier = c[c.length - 1];
    if (c.length >= 2 && /^\d{1,9}$/.test(dernier)) {
      // « texte ; fréquence » — avec la virgule, le texte peut lui-même contenir des virgules
      const texte = sep === "," ? c.slice(0, -1).join(", ") : c[0];
      res.push({ texte, usage: parseInt(dernier, 10) });
    } else {
      res.push({ texte: sep === "," ? c.join(", ") : c[0], usage: null });
    }
  });
  return res;
}
