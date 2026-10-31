import "server-only";
import { q, q1, niveauxDe } from "./db";

export type JugementJuge = { userId: number; juge: string; niveau: string | null; commentaire: string };
export type PhotoVue = { id: number; userId: number | null; auteur: string; largeur: number; hauteur: number };
export type PoneyVue = {
  id: number; numero: number | null; nom: string; sire: string; proprietaire: string; rang: number;
  moi: { niveau: string | null; commentaire: string };
  autres: JugementJuge[];
  photos: PhotoVue[];
};
export type EpreuveVue = {
  id: number; titre: string; concoursId: number; concours: string; niveaux: string[];
  version: number; modifiePar: string | null; modifieLe: string | null;
  juges: { id: number; nom: string }[];
  poneys: PoneyVue[];
};

/** État complet d'une épreuve vu par un utilisateur (ses jugements + ceux des autres membres du jury). */
export async function chargerEpreuve(epreuveId: number, userId: number): Promise<EpreuveVue | null> {
  const e = await q1<any>(
    `SELECT e.id, e.titre, e.niveaux, e.rang_version, e.rang_le, c.id AS concours_id, c.titre AS concours,
            coalesce(nullif(u.nom, ''), u.login) AS rang_par
       FROM epreuves e JOIN concours c ON c.id = e.concours_id
       LEFT JOIN utilisateurs u ON u.id = e.rang_par
      WHERE e.id = $1`, [epreuveId]
  );
  if (!e) return null;

  const juges = await q<{ id: number; nom: string }>(
    `SELECT u.id, coalesce(nullif(u.nom, ''), u.login) AS nom
       FROM jury j JOIN utilisateurs u ON u.id = j.user_id WHERE j.epreuve_id = $1 ORDER BY nom`, [epreuveId]
  );
  const poneys = await q<any>(
    "SELECT id, numero, nom, sire, proprietaire, rang FROM poneys WHERE epreuve_id = $1 ORDER BY rang, id", [epreuveId]
  );
  const jugements = await q<any>(
    `SELECT j.poney_id, j.user_id, j.niveau, j.commentaire
       FROM jugements j JOIN poneys p ON p.id = j.poney_id WHERE p.epreuve_id = $1`, [epreuveId]
  );

  // Liste des photos seulement (les images sont servies à part par /api/photos/[id])
  const photos = await q<any>(
    `SELECT ph.id, ph.poney_id, ph.user_id, ph.largeur, ph.hauteur,
            coalesce(nullif(u.nom, ''), u.login, '') AS auteur
       FROM photos ph JOIN poneys p ON p.id = ph.poney_id
       LEFT JOIN utilisateurs u ON u.id = ph.user_id
      WHERE p.epreuve_id = $1 ORDER BY ph.id`, [epreuveId]
  );
  const photosPar = new Map<number, PhotoVue[]>();
  for (const ph of photos) {
    if (!photosPar.has(ph.poney_id)) photosPar.set(ph.poney_id, []);
    photosPar.get(ph.poney_id)!.push({ id: ph.id, userId: ph.user_id, auteur: ph.auteur, largeur: ph.largeur, hauteur: ph.hauteur });
  }

  const nomJuge = new Map(juges.map((j) => [j.id, j.nom]));
  const parPoney = new Map<number, any[]>();
  for (const j of jugements) {
    if (!parPoney.has(j.poney_id)) parPoney.set(j.poney_id, []);
    parPoney.get(j.poney_id)!.push(j);
  }

  return {
    id: e.id, titre: e.titre, concoursId: e.concours_id, concours: e.concours,
    niveaux: niveauxDe(e.niveaux), version: e.rang_version,
    modifiePar: e.rang_par ?? null, modifieLe: e.rang_le ? new Date(e.rang_le).toISOString() : null,
    juges,
    poneys: poneys.map((p) => {
      const js = parPoney.get(p.id) ?? [];
      const mien = js.find((j) => j.user_id === userId);
      return {
        id: p.id, numero: p.numero, nom: p.nom, sire: p.sire, proprietaire: p.proprietaire, rang: p.rang,
        moi: { niveau: mien?.niveau ?? null, commentaire: mien?.commentaire ?? "" },
        autres: js
          .filter((j) => j.user_id !== userId && nomJuge.has(j.user_id))
          .map((j) => ({ userId: j.user_id, juge: nomJuge.get(j.user_id)!, niveau: j.niveau, commentaire: j.commentaire })),
        photos: photosPar.get(p.id) ?? [],
      };
    }),
  };
}
