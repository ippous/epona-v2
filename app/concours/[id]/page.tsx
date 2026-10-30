import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { q, q1, NIVEAUX_DEFAUT } from "@/lib/db";
import { isoJour, periode } from "@/lib/format";
import Barre from "@/components/Barre";
import BoutonConfirme from "@/components/BoutonConfirme";
import { creerEpreuve, modifierConcours, supprimerConcours } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PageConcours({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerAdmin();
  const id = Number((await params).id);
  const c = await q1<{ id: number; titre: string; lieu: string; date_debut: unknown; date_fin: unknown }>(
    "SELECT id, titre, lieu, date_debut, date_fin FROM concours WHERE id = $1", [id]
  );
  if (!c) notFound();

  const epreuves = await q<{ id: number; titre: string; nb_poneys: number; jury: string | null }>(
    `SELECT e.id, e.titre,
            (SELECT count(*)::int FROM poneys p WHERE p.epreuve_id = e.id) AS nb_poneys,
            (SELECT string_agg(coalesce(nullif(u.nom, ''), u.login), ', ' ORDER BY u.login)
               FROM jury j JOIN utilisateurs u ON u.id = j.user_id WHERE j.epreuve_id = e.id) AS jury
       FROM epreuves e WHERE e.concours_id = $1 ORDER BY e.ordre, e.id`,
    [id]
  );

  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link></div>
        <div className="entete">
          <div>
            <h1>{c.titre}</h1>
            <div className="sous">{[c.lieu, periode(c.date_debut, c.date_fin)].filter(Boolean).join(" · ")}</div>
          </div>
        </div>

        <section className="section">
          <h2>Épreuves</h2>
          <ul className="liste">
            {epreuves.map((e) => (
              <li key={e.id} className="carte">
                <div className="ligne-lien" style={{ minHeight: 0 }}>
                  <div>
                    <div className="titre">{e.titre}</div>
                    <div className="meta">
                      {e.nb_poneys} poney{e.nb_poneys > 1 ? "s" : ""} · Jury : {e.jury || <em>non désigné</em>}
                    </div>
                  </div>
                </div>
                <div className="actions" style={{ marginTop: 10 }}>
                  <Link className="btn petit" href={`/epreuve/${e.id}`}>Juger</Link>
                  <Link className="btn second petit" href={`/admin/epreuves/${e.id}`}>Paramétrer</Link>
                  <Link className="btn second petit" href={`/epreuve/${e.id}/resultats`}>Résultats</Link>
                </div>
              </li>
            ))}
            {!epreuves.length && <li className="vide">Aucune épreuve pour ce concours.</li>}
          </ul>

          <details className="depliant carte" style={{ marginTop: 12 }}>
            <summary>Ajouter une épreuve</summary>
            <form action={creerEpreuve}>
              <input type="hidden" name="concours_id" value={c.id} />
              <label htmlFor="et">Titre</label>
              <input id="et" name="titre" placeholder="ex. Modèle et allures – Femelles 3 ans" required />
              <label htmlFor="en">Niveaux de résultat (un par ligne, du plus faible au meilleur)</label>
              <textarea id="en" name="niveaux" rows={4} defaultValue={NIVEAUX_DEFAUT.join("\n")} style={{ minHeight: 0 }} />
              <div className="actions"><button className="btn">Créer l'épreuve</button></div>
            </form>
          </details>
        </section>

        <section className="section">
          <details className="depliant carte">
            <summary>Modifier le concours</summary>
            <form action={modifierConcours}>
              <input type="hidden" name="id" value={c.id} />
              <label htmlFor="t">Titre</label>
              <input id="t" name="titre" defaultValue={c.titre} required />
              <label htmlFor="l">Lieu</label>
              <input id="l" name="lieu" defaultValue={c.lieu} />
              <div className="grille2">
                <div><label htmlFor="d1">Début</label><input id="d1" name="date_debut" type="date" defaultValue={isoJour(c.date_debut)} /></div>
                <div><label htmlFor="d2">Fin</label><input id="d2" name="date_fin" type="date" defaultValue={isoJour(c.date_fin)} /></div>
              </div>
              <div className="actions"><button className="btn">Enregistrer</button></div>
            </form>
            <form action={supprimerConcours} style={{ marginTop: 20, borderTop: "1px solid var(--ligne)", paddingTop: 14 }}>
              <input type="hidden" name="id" value={c.id} />
              <BoutonConfirme message={`Supprimer « ${c.titre} », ses épreuves, poneys et jugements ? Action définitive.`}>
                Supprimer le concours
              </BoutonConfirme>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
