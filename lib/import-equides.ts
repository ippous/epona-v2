import "server-only";
import { q } from "./db";
import { decoderFichier } from "./csv";
import { normaliserNom, normaliserSexe, normaliserSire } from "./equides";

/**
 * Import d'une base d'équidés (ex. export « Base SIRE » d'Epona) : CSV ou Excel .xlsx.
 * Les colonnes sont reconnues par leur en-tête ; sans en-tête, l'ordre d'Epona est supposé :
 * Num SIRE, Nom, Sexe, Année de naissance.
 */

type Champ = "sire" | "nom" | "sexe" | "annee" | "race" | "robe" | "pere" | "mere" | "origines" | "proprietaire";
const ALIAS: [Champ, RegExp][] = [
  ["sire", /^(num(ero)?\s*)?(sire|ueln)|^n\s*sire|^immatriculation/],
  ["annee", /^(annee|an)(\s*de)?(\s*naissance)?$|^naissance$|^date\s*(de\s*)?naissance|^ne\s*en/],
  ["sexe", /^sexe$/],
  ["race", /^race|^stud\s*book/],
  ["robe", /^robe/],
  ["pere", /^pere$|^nom\s*(du\s*)?pere/],
  ["mere", /^mere$|^nom\s*(de\s*la\s*)?mere/],
  ["origines", /^origines?|^filiation|^pedigree/],
  ["proprietaire", /^proprietaire|^naisseur|^eleveur/],
  ["nom", /^nom(\s*(du\s*)?(cheval|poney|equide))?$|^name$/],
];
const cleEntete = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function lireCsv(texte: string): string[][] {
  const lignes = texte.replace(/^﻿/, "").split(/\r\n|\n|\r/).filter((l) => l.trim());
  const sep = [";", "\t", ","].find((c) => lignes.slice(0, 5).some((l) => l.includes(c))) ?? ";";
  return lignes.map((l) => {
    const cel: string[] = [];
    let cur = "", g = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (g) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') g = false; else cur += c; }
      else if (c === '"' && !cur.trim()) { g = true; cur = ""; }
      else if (c === sep) { cel.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    cel.push(cur.trim());
    return cel;
  });
}

function texteCellule(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return String(v.getFullYear());
  return String(v).trim();
}

export type LigneEquide = {
  sire: string; nom: string; cle: string; sexe: string; annee: number | null;
  race: string; robe: string; origines: string; proprietaire: string;
};

export async function lireTableauEquides(
  octets: ArrayBuffer, nomFichier: string
): Promise<{ lignes: LigneEquide[]; colonnes: string[] } | { erreur: string }> {
  let brut: string[][];
  const entete = new Uint8Array(octets.slice(0, 4));
  const estXlsx = /\.xlsx$/i.test(nomFichier) || (entete[0] === 0x50 && entete[1] === 0x4b); // « PK » : zip
  if (estXlsx) {
    const { readSheet } = await import("read-excel-file/universal");
    const feuille = await readSheet(octets);
    brut = (feuille as unknown[][]).map((l) => l.map(texteCellule));
  } else if (/\.xls$/i.test(nomFichier)) {
    return { erreur: "Ancien format Excel (.xls) : enregistrez le fichier en .xlsx ou en CSV." };
  } else {
    brut = lireCsv(decoderFichier(octets));
  }
  brut = brut.filter((l) => l.some((c) => c));
  if (!brut.length) return { erreur: "Le fichier est vide." };

  // Repérage des colonnes par l'en-tête
  const index: Partial<Record<Champ, number>> = {};
  brut[0].forEach((cellule, i) => {
    const k = cleEntete(cellule);
    const trouve = ALIAS.find(([champ, re]) => index[champ] === undefined && re.test(k));
    if (trouve) index[trouve[0]] = i;
  });
  let debut = 1;
  if (index.nom === undefined) {
    // Pas d'en-tête reconnu : ordre d'Epona (SIRE, Nom, Sexe, Année)
    Object.assign(index, { sire: 0, nom: 1, sexe: 2, annee: 3 });
    for (const k of Object.keys(index) as Champ[]) if (index[k]! >= brut[0].length) delete index[k];
    debut = /^\d{6,}/.test(normaliserSire(brut[0][0] ?? "")) ? 0 : 1;
  }

  const val = (l: string[], c: Champ) => (index[c] !== undefined ? (l[index[c]!] ?? "").trim() : "");
  const lignes: LigneEquide[] = [];
  for (const l of brut.slice(debut)) {
    const nom = val(l, "nom").slice(0, 120);
    const a = parseInt(val(l, "annee").match(/(19|20)\d\d/)?.[0] ?? "", 10);
    const pere = val(l, "pere"), mere = val(l, "mere");
    lignes.push({
      sire: normaliserSire(val(l, "sire")), nom, cle: normaliserNom(nom),
      sexe: normaliserSexe(val(l, "sexe")).slice(0, 20),
      annee: Number.isFinite(a) ? a : null,
      race: val(l, "race").slice(0, 80), robe: val(l, "robe").slice(0, 60),
      origines: (val(l, "origines") || (pere || mere ? `${pere || "?"} × ${mere || "?"}` : "")).slice(0, 240),
      proprietaire: val(l, "proprietaire").slice(0, 160),
    });
  }
  const noms: Record<Champ, string> = {
    sire: "SIRE", nom: "nom", sexe: "sexe", annee: "année", race: "race", robe: "robe",
    pere: "père", mere: "mère", origines: "origines", proprietaire: "propriétaire",
  };
  return { lignes, colonnes: (Object.keys(index) as Champ[]).map((c) => noms[c]) };
}

const PAQUET = 2000;

export async function importerLignesEquides(lignes: LigneEquide[]) {
  let ignores = 0;
  const avecSire = new Map<string, LigneEquide>();
  const sansSire = new Map<string, LigneEquide>();
  for (const l of lignes) {
    if (!l.cle) { ignores++; continue; }
    if (l.sire) avecSire.set(l.sire, l);
    else sansSire.set(`${l.cle}|${l.annee ?? ""}`, l);
  }
  let ajoutes = 0, misAJour = 0;
  const col = (t: LigneEquide[], k: keyof LigneEquide) => t.map((l) => l[k]);

  const a = [...avecSire.values()];
  for (let i = 0; i < a.length; i += PAQUET) {
    const t = a.slice(i, i + PAQUET);
    const r = await q<{ insere: boolean }>(
      `INSERT INTO equides (sire, nom, cle_nom, sexe, annee, race, robe, origines, proprietaire, source)
       SELECT *, 'import' FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[], $8::text[], $9::text[])
       ON CONFLICT (sire) WHERE sire <> '' DO UPDATE SET
         nom = EXCLUDED.nom, cle_nom = EXCLUDED.cle_nom,
         sexe = CASE WHEN EXCLUDED.sexe <> '' THEN EXCLUDED.sexe ELSE equides.sexe END,
         annee = coalesce(EXCLUDED.annee, equides.annee),
         race = CASE WHEN EXCLUDED.race <> '' THEN EXCLUDED.race ELSE equides.race END,
         robe = CASE WHEN EXCLUDED.robe <> '' THEN EXCLUDED.robe ELSE equides.robe END,
         origines = CASE WHEN EXCLUDED.origines <> '' THEN EXCLUDED.origines ELSE equides.origines END,
         proprietaire = CASE WHEN EXCLUDED.proprietaire <> '' THEN EXCLUDED.proprietaire ELSE equides.proprietaire END,
         maj_le = now()
       RETURNING (xmax = 0) AS insere`,
      [col(t, "sire"), col(t, "nom"), col(t, "cle"), col(t, "sexe"), col(t, "annee"), col(t, "race"), col(t, "robe"), col(t, "origines"), col(t, "proprietaire")]
    );
    const n = r.filter((x) => x.insere).length;
    ajoutes += n; misAJour += r.length - n;
  }

  const b = [...sansSire.values()];
  for (let i = 0; i < b.length; i += PAQUET) {
    const t = b.slice(i, i + PAQUET);
    const r = await q(
      `INSERT INTO equides (sire, nom, cle_nom, sexe, annee, race, robe, origines, proprietaire, source)
       SELECT '', x.nom, x.cle, x.sexe, x.annee, x.race, x.robe, x.origines, x.prop, 'import'
         FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::text[], $6::text[], $7::text[], $8::text[])
              AS x(nom, cle, sexe, annee, race, robe, origines, prop)
        WHERE NOT EXISTS (SELECT 1 FROM equides e WHERE e.cle_nom = x.cle AND (e.annee IS NULL OR x.annee IS NULL OR e.annee = x.annee))
       RETURNING id`,
      [col(t, "nom"), col(t, "cle"), col(t, "sexe"), col(t, "annee"), col(t, "race"), col(t, "robe"), col(t, "origines"), col(t, "proprietaire")]
    );
    ajoutes += r.length;
  }
  return { ajoutes, misAJour, ignores };
}
