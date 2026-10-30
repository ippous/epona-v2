import Link from "next/link";
import { exigerConnexion } from "@/lib/auth";
import { q } from "@/lib/db";
import { periode } from "@/lib/format";
import Barre from "@/components/Barre";
import { creerConcours } from "./actions";

export const dynamic = "force-dynamic";

type EpreuveJuge = {
  id: number; titre: string; concours_id: number; concours: string; lieu: string;
  date_debut: unknown; date_fin: unknown; nb_poneys: number; nb_juges: number;
};

export default async function Accueil() {
  const u = await exigerConnexion();

  const mesEpreuves = await q<EpreuveJuge>(
    `SELECT e.id, e.titre, c.id AS concours_id, c.titre AS concours, c.lieu, c.date_debut, c.date_fin,
            (SELECT count(*)::int FROM poneys p WHERE p.epreuve_id = e.id) AS nb_poneys,
            (SELECT count(*)::int FROM poneys p JOIN jugements j ON j.poney_id = p.id
              WHERE p.epreuve_id = e.id AND j.user_id = $1 AND j.niveau IS NOT NULL) AS nb_juges
       FROM jury jr JOIN epreuves e ON e.id = jr.epreuve_id JOIN concours c ON c.id = e.concours_id
      WHERE jr.user_id = $1
      ORDER BY c.date_debut DESC NULLS LAST, c.id DESC, e.ordre`,
    [u.id]
  );

  const groupes = new Map<number, { titre: string; lieu: string; dates: string; epreuves: EpreuveJuge[] }>();
  for (const e of mesEpreuves) {
    if (!groupes.has(e.concours_id)) {
      groupes.set(e.concours_id, { titre: e.concours, lieu: e.lieu, dates: periode(e.date_debut, e.date_fin), epreuves: [] });
    }
    groupes.get(e.concours_id)!.epreuves.push(e);
  }

  const tousConcours =
    u.role === "ADMIN"
      ? await q<{ id: number; titre: string; lieu: string; date_debut: unknown; date_fin: unknown; nb: number }>(
          `SELECT c.id, c.titre, c.lieu, c.date_debut, c.date_fin,
                  (SELECT count(*)::int FROM epreuves e WHERE e.concours_id = c.id) AS nb
             FROM concours c ORDER BY c.date_debut DESC NULLS LAST, c.id DESC`
        )
      : [];

  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="entete">
          <div>
            <h1>Bonjour {u.nom || u.login}</h1>
            <div className="sous">{mesEpreuves.length ? "Vos épreuves à juger" : "Aucune épreuve ne vous est attribuée pour l'instant."}</div>
          </div>
        </div>

        {[...groupes.entries()].map(([cid, g]) => (
          <section key={cid} className="section">
            <h2>
              <span>{g.titre}</span>
              <span className="pastille">{[g.lieu, g.dates].filter(Boolean).join(" · ")}</span>
            </h2>
            <ul className="liste">
              {g.epreuves.map((e) => (
                <li key={e.id} className="carte">
                  <Link className="ligne-lien" href={`/epreuve/${e.id}`}>
                    <div>
                      <div className="titre">{e.titre}</div>
                      <div className="meta">
                        {e.nb_poneys} poney{e.nb_poneys > 1 ? "s" : ""} · {e.nb_juges}/{e.nb_poneys} jugé{e.nb_juges > 1 ? "s" : ""}
                      </div>
                    </div>
                    {e.nb_poneys > 0 && e.nb_juges === e.nb_poneys ? <span className="pastille">Terminé</span> : <span className="chevron">›</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {u.role === "ADMIN" && (
          <section className="section">
            <h2>Tous les concours</h2>
            <ul className="liste">
              {tousConcours.map((c) => (
                <li key={c.id} className="carte">
                  <Link className="ligne-lien" href={`/concours/${c.id}`}>
                    <div>
                      <div className="titre">{c.titre}</div>
                      <div className="meta">{[c.lieu, periode(c.date_debut, c.date_fin), `${c.nb} épreuve${c.nb > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className="chevron">›</span>
                  </Link>
                </li>
              ))}
              {!tousConcours.length && <li className="vide">Aucun concours. Créez le premier ci-dessous.</li>}
            </ul>

            <details className="depliant carte" style={{ marginTop: 12 }}>
              <summary>Nouveau concours</summary>
              <form action={creerConcours}>
                <label htmlFor="titre">Titre</label>
                <input id="titre" name="titre" required />
                <label htmlFor="lieu">Lieu</label>
                <input id="lieu" name="lieu" />
                <div className="grille2">
                  <div><label htmlFor="dd">Début</label><input id="dd" name="date_debut" type="date" /></div>
                  <div><label htmlFor="df">Fin</label><input id="df" name="date_fin" type="date" /></div>
                </div>
                <div className="actions"><button className="btn">Créer le concours</button></div>
              </form>
            </details>
          </section>
        )}
      </main>
    </>
  );
}
