import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerAdmin } from "@/lib/auth";
import { q, q1, niveauxDe } from "@/lib/db";
import Barre from "@/components/Barre";
import BoutonConfirme from "@/components/BoutonConfirme";
import FormPoney from "./FormPoney";
import { RACES_API } from "@/lib/equides";
import {
  ajouterPoney, enregistrerJury, importerPoneys, modifierEpreuve, modifierPoney, supprimerEpreuve, supprimerPoney,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  epreuve: "Épreuve enregistrée.",
  jury: "Jury enregistré.",
  import: "Liste importée.",
  poney: "Poney enregistré.",
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
  const poneys = await q<{
    id: number; numero: number | null; nom: string; sire: string; proprietaire: string;
    sexe: string; annee: number | null; race: string; robe: string; origines: string; nb_jug: number;
  }>(
    `SELECT p.id, p.numero, p.nom, p.sire, p.proprietaire, p.sexe, p.annee, p.race, p.robe, p.origines,
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
                    {(p.sire || p.annee) && (
                      <span style={{ color: "var(--doux)", fontWeight: 400 }}> · {[p.sire, p.sexe, p.annee].filter(Boolean).join(" · ")}</span>
                    )}
                  </summary>
                  <FormPoney
                    key={`${p.id}-${p.nom}-${p.sire}-${p.annee}-${p.origines}`}
                    action={modifierPoney} cachés={{ id: p.id }} libelle="Enregistrer"
                    initial={{
                      numero: p.numero != null ? String(p.numero) : "", nom: p.nom, sire: p.sire, proprietaire: p.proprietaire,
                      sexe: p.sexe, annee: p.annee ? String(p.annee) : "", race: p.race, robe: p.robe, origines: p.origines,
                    }}
                  />
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

          <details className="depliant carte" style={{ marginTop: 12 }} open={ok === "poney" || !poneys.length}>
            <summary>Ajouter un poney</summary>
            <p className="aide" style={{ marginTop: 0 }}>
              Tapez le nom pour voir les suggestions, ou touchez la loupe : la recherche porte sur notre base et sur l'API Équidés
              (fiches publiques IFCE{RACES_API.length ? `, races ${RACES_API.join(" et ")} uniquement` : ""}). Par SIRE, seule notre base est interrogée.
            </p>
            {/* key : formulaire vidé après chaque ajout, pour enchaîner les saisies */}
            <FormPoney key={`ajout-${poneys.length}`} action={ajouterPoney} cachés={{ epreuve_id: e.id }} libelle="Ajouter" />
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
