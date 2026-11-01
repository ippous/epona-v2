import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerConnexion, peutJuger } from "@/lib/auth";
import { chargerEpreuve } from "@/lib/epreuve";
import { couleurNiveau } from "@/lib/format";
import Barre from "@/components/Barre";
import "./resultats.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Résultats" };

export default async function Resultats({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerConnexion();
  const id = Number((await params).id);
  if (!(await peutJuger(u, id))) notFound();
  const vue = await chargerEpreuve(id, u.id);
  if (!vue) notFound();

  const niv = (n: string | null) => {
    const i = n ? vue.niveaux.indexOf(n) : -1;
    if (i < 0) return <span className="niv-r vide-n">—</span>;
    const c = couleurNiveau(i, vue.niveaux.length);
    return <span className="niv-r" style={{ background: c.fond, color: c.texte }}>{n}</span>;
  };

  // Tous les jugements d'un poney, juge par juge (le mien est dans « moi »)
  const avis = (p: (typeof vue.poneys)[number]) =>
    vue.juges.map((j) => {
      if (j.id === u.id) return { juge: j.nom, niveau: p.moi.niveau, commentaire: p.moi.commentaire };
      const a = p.autres.find((x) => x.userId === j.id);
      return { juge: j.nom, niveau: a?.niveau ?? null, commentaire: a?.commentaire ?? "" };
    });

  return (
    <>
      <Barre u={u} />
      <main className="page resultats">
        <div className="fil">
          <Link href={u.role === "ADMIN" ? `/concours/${vue.concoursId}` : "/"}>{vue.concours}</Link> ›{" "}
          <Link href={`/epreuve/${vue.id}`}>{vue.titre}</Link>
        </div>
        <div className="entete">
          <div>
            <h1>Résultats</h1>
            <div className="sous">{vue.titre} · {vue.poneys.length} poneys · {vue.juges.length} juge{vue.juges.length > 1 ? "s" : ""}</div>
          </div>
          <a className="btn petit" href={`/api/epreuves/${vue.id}/export`}>Export CSV</a>
        </div>

        <ol className="liste-res">
          {vue.poneys.map((p, i) => (
            <li key={p.id} className="carte">
              <div className="res-tete">
                <span className="res-rang">{i + 1}</span>
                <div>
                  <div className="res-nom">{p.numero != null && <span className="num">n°{p.numero} </span>}{p.nom}</div>
                  <div className="aide" style={{ marginTop: 0 }}>{[p.sexe, p.annee, p.race, p.robe].filter(Boolean).join(" · ")}</div>
                  {p.origines && <div className="aide" style={{ marginTop: 0 }}>{p.origines}</div>}
                  <div className="aide" style={{ marginTop: 0 }}>{[p.sire, p.proprietaire].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              {p.photos.length > 0 && (
                <div className="res-photos">
                  {p.photos.map((ph) => (
                    <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noopener">
                      <img src={`/api/photos/${ph.id}?t=mini`} alt={`Photo de ${p.nom}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <ul className="res-avis">
                {avis(p).map((a) => (
                  <li key={a.juge}>
                    <div className="res-juge"><strong>{a.juge}</strong> {niv(a.niveau)}</div>
                    {a.commentaire && <p>{a.commentaire}</p>}
                  </li>
                ))}
                {!vue.juges.length && <li className="aide">Aucun juge désigné.</li>}
              </ul>
            </li>
          ))}
        </ol>
        {!vue.poneys.length && <p className="vide carte">Aucun poney engagé.</p>}
      </main>
    </>
  );
}
