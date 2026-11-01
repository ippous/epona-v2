import "server-only";
import { q, q1 } from "./db";

/**
 * Base des équidés : notre base (poneys déjà saisis + imports type « Base SIRE ») et l'API Équidés
 * (api-equides.org : fiches publiques de l'IFCE, sans numéro SIRE ni propriétaire).
 */

export type InfosEquide = {
  nom: string; sire: string; sexe: string; annee: number | null;
  race: string; robe: string; origines: string; proprietaire: string;
};
export type ResultatEquide = InfosEquide & {
  source: "base" | "ifce";
  ifceId?: string;   // fiche IFCE à compléter (père et mère) au moment du choix
  complet: boolean;
};

const API = (process.env.EQUIDES_API_URL || "https://api-equides.org").replace(/\/$/, "");

export const normaliserSire = (s: string) => s.toUpperCase().replace(/[\s.\-]/g, "").slice(0, 20);
export const normaliserNom = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const SEXES: Record<string, string> = { m: "Mâle", male: "Mâle", f: "Femelle", femelle: "Femelle", h: "Hongre", hongre: "Hongre" };
export function normaliserSexe(s: string): string {
  const k = normaliserNom(s);
  return SEXES[k] ?? (s.trim() ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase() : "");
}

function versInfos(r: any): InfosEquide {
  return {
    nom: r.nom ?? "", sire: r.sire ?? "", sexe: r.sexe ?? "", annee: r.annee ?? null,
    race: r.race ?? "", robe: r.robe ?? "", origines: r.origines ?? "", proprietaire: r.proprietaire ?? "",
  };
}

/* ---------------- Notre base ---------------- */

export async function chercherBase(texte: string, mode: "nom" | "sire", limite = 8): Promise<ResultatEquide[]> {
  let lignes: any[];
  if (mode === "sire") {
    const s = normaliserSire(texte);
    if (s.length < 3) return [];
    // SIRE complet ou début de numéro (8 chiffres + lettre clé)
    lignes = await q(
      "SELECT * FROM equides WHERE sire LIKE $1 ORDER BY (sire = $2) DESC, sire LIMIT $3",
      [s.replace(/[%_]/g, "") + "%", s, limite]
    );
  } else {
    const n = normaliserNom(texte);
    if (n.length < 2) return [];
    const motif = n.replace(/[%_]/g, "");
    lignes = await q(
      `SELECT * FROM equides
        WHERE cle_nom LIKE $1 OR cle_nom LIKE $2
        ORDER BY (cle_nom = $3) DESC, (cle_nom LIKE $1) DESC, (sire <> '') DESC, annee DESC NULLS LAST, nom
        LIMIT $4`,
      [motif + "%", "% " + motif + "%", n, limite]
    );
  }
  return lignes.map((r) => ({ ...versInfos(r), source: "base" as const, complet: true }));
}

/** Ajoute ou complète un équidé de notre base (clé : SIRE, sinon nom + année). Les champs vides n'écrasent rien. */
export async function enregistrerEquide(e: Partial<InfosEquide> & { nom: string }, source = "saisie", ifceId = "") {
  const nom = e.nom.trim();
  if (!nom) return;
  const sire = normaliserSire(e.sire ?? "");
  const v = {
    nom, cle: normaliserNom(nom), sexe: e.sexe ?? "", annee: e.annee ?? null, race: e.race ?? "",
    robe: e.robe ?? "", origines: e.origines ?? "", proprietaire: e.proprietaire ?? "",
  };
  // Tous les paramètres ($1…$11) figurent dans chaque requête : Postgres doit pouvoir en déduire le type.
  const maj = `nom = $2, cle_nom = $3,
      sire = CASE WHEN $1 <> '' THEN $1 ELSE equides.sire END,
      sexe = CASE WHEN $4 <> '' THEN $4 ELSE equides.sexe END,
      annee = coalesce($5, equides.annee),
      race = CASE WHEN $6 <> '' THEN $6 ELSE equides.race END,
      robe = CASE WHEN $7 <> '' THEN $7 ELSE equides.robe END,
      origines = CASE WHEN $8 <> '' THEN $8 ELSE equides.origines END,
      proprietaire = CASE WHEN $9 <> '' THEN $9 ELSE equides.proprietaire END,
      ifce_id = CASE WHEN $11 <> '' THEN $11 ELSE equides.ifce_id END,
      source = $10,
      maj_le = now()`;
  const params = [sire, v.nom, v.cle, v.sexe, v.annee, v.race, v.robe, v.origines, v.proprietaire, source, ifceId];

  if (sire) {
    // Un équidé connu sans SIRE (même nom, même année) reçoit son numéro
    const sansSire = await q1<{ id: number }>(
      "SELECT id FROM equides WHERE sire = '' AND cle_nom = $1 AND (annee IS NULL OR $2::int IS NULL OR annee = $2) LIMIT 1",
      [v.cle, v.annee]
    );
    if (sansSire && !(await q1("SELECT 1 FROM equides WHERE sire = $1", [sire]))) {
      await q(`UPDATE equides SET ${maj} WHERE id = $12`, [...params, sansSire.id]);
      return;
    }
    await q(
      `INSERT INTO equides (sire, nom, cle_nom, sexe, annee, race, robe, origines, proprietaire, source, ifce_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (sire) WHERE sire <> '' DO UPDATE SET ${maj}`,
      params
    );
  } else {
    const deja = await q1<{ id: number }>(
      "SELECT id FROM equides WHERE cle_nom = $1 AND (annee IS NULL OR $2::int IS NULL OR annee = $2) ORDER BY (sire <> '') DESC LIMIT 1",
      [v.cle, v.annee]
    );
    if (deja) await q(`UPDATE equides SET ${maj} WHERE id = $12`, [...params, deja.id]);
    else {
      await q(
        `INSERT INTO equides (sire, nom, cle_nom, sexe, annee, race, robe, origines, proprietaire, source, ifce_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        params
      );
    }
  }
}

/* ---------------- API Équidés (api-equides.org) ---------------- */

async function appelApi(chemin: string): Promise<any | null> {
  try {
    const r = await fetch(API + chemin, {
      headers: { Accept: "application/json", "User-Agent": "epona-v2 (jugement de concours)" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 }, // les fiches publiques changent peu : cache d'un jour
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null; // API injoignable : la recherche continue avec notre base
  }
}

function depuisResume(r: any): ResultatEquide {
  return {
    nom: String(r.nom ?? ""), sire: "", sexe: normaliserSexe(String(r.sexe ?? "")),
    annee: Number.isFinite(r.annee_naissance) ? r.annee_naissance : null,
    race: String(r.race ?? ""), robe: String(r.robe ?? ""), origines: "", proprietaire: "",
    source: "ifce", ifceId: String(r.id ?? ""), complet: false,
  };
}

export async function chercherApi(texte: string, limite = 8): Promise<{ resultats: ResultatEquide[]; joignable: boolean }> {
  const qn = texte.trim();
  if (qn.length < 2) return { resultats: [], joignable: true };
  const j = await appelApi(`/v1/search?q=${encodeURIComponent(qn)}&limite=${limite}`);
  if (!j) return { resultats: [], joignable: false };
  return { resultats: (Array.isArray(j.resultats) ? j.resultats : []).map(depuisResume), joignable: true };
}

/** Fiche complète IFCE : ajoute père et mère (origines). */
export async function ficheApi(id: string): Promise<ResultatEquide | null> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return null;
  const f = await appelApi(`/v1/equides/${id}`);
  if (!f) return null;
  const pere = f.pere?.nom ? String(f.pere.nom) : "";
  const mere = f.mere?.nom ? String(f.mere.nom) : "";
  const pdm = f.pere_de_mere?.nom ? String(f.pere_de_mere.nom) : "";
  const origines = pere || mere ? `${pere || "?"} × ${mere || "?"}${pdm ? ` (par ${pdm})` : ""}` : String(f.filiation_texte ?? "");
  return { ...depuisResume(f), origines, complet: true };
}

/* ---------------- Recherche combinée ---------------- */

const memeEquide = (a: InfosEquide, b: InfosEquide) =>
  normaliserNom(a.nom) === normaliserNom(b.nom) && (a.annee == null || b.annee == null || a.annee === b.annee);

export async function rechercher(texte: string, mode: "nom" | "sire") {
  if (mode === "sire") {
    return { resultats: await chercherBase(texte, "sire"), apiJoignable: true, apiInterrogee: false };
  }
  const [base, api] = await Promise.all([chercherBase(texte, "nom", 6), chercherApi(texte, 8)]);
  const autres = api.resultats.filter((r) => !base.some((b) => memeEquide(b, r)));
  return { resultats: [...base, ...autres].slice(0, 12), apiJoignable: api.joignable, apiInterrogee: true };
}
