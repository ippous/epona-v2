import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { q, q1, niveauxDe } from "@/lib/db";
import Barre from "@/components/Barre";
import BoutonConfirme from "@/components/BoutonConfirme";
import {
  ajouterPoney, enregistrerJury, importerPoneys, modifierEpreuve, modifierPoney, supprimerEpreuve, supprimerPoney,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  epreuve: "Épreuve enregistrée.",
  jury: "Jury enregistré.",
  import: "Liste importée.",
};

export default async function AdminEpreuve({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const u = await exigerAdmin();
  const id = Number((await params).id);
  const ok = (await searchParams).ok;

  const e = await q1<{ id: number; titre: string; niveaux: unknown; concours_id: number; concours: string }>(
    `SELECT e.id, e.titre, e.niveaux, c.id AS concours_id, c.titre AS concours
       FROM epreuves e JOIN concours c ON c.id = e.concours_id WHERE e.id = $1`, [id]
  );
  if (!e) notFound();
  const niveaux = niveauxDe(e.niveaux);

  const utilisateurs = await q<{ id: number; login: string; nom: string; role: string; membre: boolean }>(
    `SELECT u.id, u.login, u.nom, u.role,
            EXISTS (SELECT 1 FROM jury j WHERE j.epreuve_id = $1 AND j.user_id = u.id) AS membre
       FROM utilisateurs u WHERE u.actif ORDER BY u.nom, u.login`, [id]
  );
  const poneys = await q<{ id: number; numero: number | null; nom: string; sire: string; proprietaire: string; nb_jug: number }>(
    `SELECT p.id, p.numero, p.nom, p.sire, p.proprietaire,
            (SELECT count(*)::int FROM jugements j WHERE j.poney_id = p.id AND (j.niveau IS NOT NULL OR j.commentaire <> '')) AS nb_jug
       FROM poneys p WHERE p.epreuve_id = $1 ORDER BY p.numero NULLS LAST, p.id`, [id]
  );

  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link> › <Link href={`/concours/${e.concours_id}`}>{e.concours}</Link></div>
        <div className="entete">
          <div>
            <h1>{e.titre}</h1>
            <div className="sous">Paramétrage de l'épreuve</div>
          </div>
          <Link className="btn petit" href={`/epreuve/${e.id}`}>Juger</Link>
        </div>
        {ok && MESSAGES[ok] && <p className="message ok">{MESSAGES[ok]}</p>}

        <section className="section">
          <h2>Épreuve et niveaux</h2>
          <form action={modifierEpreuve} className="carte">
            <input type="hidden" name="id" value={e.id} />
            <label htmlFor="t">Titre</label>
            <input id="t" name="titre" defaultValue={e.titre} required />
            <label htmlFor="n">Niveaux de résultat</label>
            <textarea id="n" name="niveaux" rows={Math.max(4, niveaux.length)} defaultValue={niveaux.join("\n")} style={{ minHeight: 0 }} />
            <p className="aide">Un niveau par ligne, du plus faible au meilleur. Renommer un niveau déjà attribué ne met pas à jour les jugements existants.</p>
            <div className="actions"><button className="btn">Enregistrer</button></div>
          </form>
        </section>

        <section className="section">
          <h2>Jury</h2>
          <form action={enregistrerJury} className="carte">
            <input type="hidden" name="id" value={e.id} />
            <div className="coches">
              {utilisateurs.map((x) => (
                <label key={x.id} className="coche">
                  <input type="checkbox" name="juges" value={x.id} defaultChecked={x.membre} />
                  <span>{x.nom || x.login} <span style={{ color: "var(--doux)", fontSize: "0.85rem" }}>({x.login}{x.role === "ADMIN" ? ", admin" : ""})</span></span>
                </label>
              ))}
            </div>
            <div className="actions"><button className="btn">Enregistrer le jury</button></div>
          </form>
        </section>

        <section className="section" id="poneys">
          <h2><span>Poneys engagés</span><span className="pastille">{poneys.length}</span></h2>
          <ul className="liste">
            {poneys.map((p) => (
              <li key={p.id} className="carte">
                <details className="depliant">
                  <summary style={{ color: "var(--encre)" }}>
                    {p.numero != null ? `n°${p.numero} · ` : ""}{p.nom}
                    {p.sire && <span style={{ color: "var(--doux)", fontWeight: 400 }}> · {p.sire}</span>}
                  </summary>
                  <form action={modifierPoney}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grille2">
                      <div><label>N°</label><input name="numero" inputMode="numeric" defaultValue={p.numero ?? ""} /></div>
                      <div><label>Nom</label><input name="nom" defaultValue={p.nom} required /></div>
                      <div><label>SIRE</label><input name="sire" defaultValue={p.sire} autoCapitalize="characters" /></div>
                      <div><label>Propriétaire</label><input name="proprietaire" defaultValue={p.proprietaire} /></div>
                    </div>
                    <div className="actions"><button className="btn petit">Enregistrer</button></div>
                  </form>
                  <form action={supprimerPoney} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <BoutonConfirme message={`Retirer ${p.nom} de l'épreuve${p.nb_jug ? ` (${p.nb_jug} jugement(s) seront perdus)` : ""} ?`}>
                      Retirer
                    </BoutonConfirme>
                  </form>
                </details>
              </li>
            ))}
            {!poneys.length && <li className="vide">Aucun poney engagé.</li>}
          </ul>

          <details className="depliant carte" style={{ marginTop: 12 }}>
            <summary>Ajouter un poney</summary>
            <form action={ajouterPoney}>
              <input type="hidden" name="epreuve_id" value={e.id} />
              <div className="grille2">
                <div><label>N°</label><input name="numero" inputMode="numeric" /></div>
                <div><label>Nom</label><input name="nom" required /></div>
                <div><label>SIRE</label><input name="sire" autoCapitalize="characters" /></div>
                <div><label>Propriétaire</label><input name="proprietaire" /></div>
              </div>
              <div className="actions"><button className="btn">Ajouter</button></div>
            </form>
          </details>

          <details className="depliant carte" style={{ marginTop: 8 }}>
            <summary>Coller une liste</summary>
            <form action={importerPoneys}>
              <input type="hidden" name="epreuve_id" value={e.id} />
              <textarea name="liste" rows={6} placeholder={"1;NOUGAT DE FREM;23300295R;Élevage du Frem\n2;NEW DREAM;23382428R;M. Dupont"} />
              <p className="aide">Une ligne par poney : n° ; nom ; SIRE ; propriétaire. Séparateur point-virgule ou tabulation (copier-coller depuis Excel accepté).</p>
              <div className="actions"><button className="btn">Importer</button></div>
            </form>
          </details>
        </section>

        <section className="section">
          <form action={supprimerEpreuve}>
            <input type="hidden" name="id" value={e.id} />
            <BoutonConfirme message={`Supprimer l'épreuve « ${e.titre} », ses poneys et tous les jugements ?`}>
              Supprimer l'épreuve
            </BoutonConfirme>
          </form>
        </section>
      </main>
    </>
  );
}
