// Données de démonstration : 3 juges, un concours, deux épreuves et leurs poneys.
// En local, arrêter l'appli avant de lancer le script (la base embarquée n'accepte qu'un processus).
//   npm run seed                            → base locale .pglite
//   DATABASE_URL=postgres://… npm run seed  → base Neon
import bcrypt from "bcryptjs";
import { SCHEMA } from "../lib/schema.mjs";

let run, fin = async () => {};
if (process.env.DATABASE_URL) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  run = (t, p = []) => sql.query(t, p);
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(process.env.PGLITE_DIR || "./.pglite");
  run = async (t, p = []) => (await pg.query(t, p)).rows;
  fin = () => pg.close();
}

for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await run(stmt);

const mdp = await bcrypt.hash("jury2026!", 10);
const juges = [];
for (const [login, nom] of [["cmartin", "C. Martin"], ["plefevre", "P. Lefèvre"], ["adurand", "A. Durand"]]) {
  const r = await run(
    `INSERT INTO utilisateurs (login, nom, mot_de_passe, role) VALUES ($1, $2, $3, 'JUGE')
     ON CONFLICT (login) DO UPDATE SET nom = EXCLUDED.nom RETURNING id`,
    [login, nom, mdp]
  );
  juges.push(r[0].id);
}

const [c] = await run(
  "INSERT INTO concours (titre, date_debut, date_fin, lieu) VALUES ($1, $2, $3, $4) RETURNING id",
  ["Concours régional d'élevage – démo", "2026-11-14", "2026-11-15", "Lamotte-Beuvron (41)"]
);

const epreuves = [
  {
    titre: "Femelles 3 ans – Modèle et allures",
    niveaux: ["Sans Qualification", "A Revoir", "Excellent", "Très Excellent"],
    poneys: [
      [12, "OPALE DU FRAT", "26012345K", "Élevage du Frat"],
      [7, "ORCHIDÉE DES VIGNES", "26098765B", "M. Garnier"],
      [3, "OCARINA", "26055512C", "Écurie des Saules"],
      [21, "OLYMPE DE LA COTE", "26044421D", "Mme Roux"],
      [9, "ONDINE DU MOULIN", "26033318E", "Élevage du Moulin"],
      [15, "OSAKA BLUE", "26022276F", "M. Petit"],
    ],
  },
  {
    titre: "Mâles 2 ans – Approbation",
    niveaux: ["Non approuvé", "A Revoir", "Approuvé", "Approuvé avec mention"],
    poneys: [
      [31, "PRINCE DES LANDES", "27011122G", "Haras des Landes"],
      [34, "PAPRIKA DU VAL", "27022233H", "M. Lambert"],
      [38, "PIXEL", "27033344J", "Écurie Fontaine"],
    ],
  },
];

for (const [i, e] of epreuves.entries()) {
  const [ep] = await run(
    "INSERT INTO epreuves (concours_id, titre, niveaux, ordre) VALUES ($1, $2, $3::jsonb, $4) RETURNING id",
    [c.id, e.titre, JSON.stringify(e.niveaux), i + 1]
  );
  for (const j of juges) await run("INSERT INTO jury VALUES ($1, $2) ON CONFLICT DO NOTHING", [ep.id, j]);
  for (const [k, [num, nom, sire, prop]] of e.poneys.entries()) {
    await run(
      "INSERT INTO poneys (epreuve_id, numero, nom, sire, proprietaire, rang) VALUES ($1, $2, $3, $4, $5, $6)",
      [ep.id, num, nom, sire, prop, k + 1]
    );
  }
}

console.log(`Démo créée. Juges : cmartin, plefevre, adurand (mot de passe jury2026!)`);
await fin();
