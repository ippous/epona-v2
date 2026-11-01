import Link from "next/link";
import { exigerAdmin } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { normaliserNom, normaliserSire } from "@/lib/equides";
import Barre from "@/components/Barre";
import BoutonConfirme from "@/components/BoutonConfirme";
import { viderEquides } from "@/app/actions";
import FormImportEquides from "./FormImportEquides";

export const dynamic = "force-dynamic";
export const metadata = { title: "Base équidés" };

const SOURCES: Record<string, string> = { import: "import", saisie: "saisi", ifce: "IFCE" };

export default async function BaseEquides({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await exigerAdmin();
  const texte = ((await searchParams).q ?? "").trim().slice(0, 80);
  const total = (await q1<{ n: number }>("SELECT count(*)::int AS n FROM equides"))?.n ?? 0;

  let lignes: any[] = [];
  if (texte) {
    const s = normaliserSire(texte), n = normaliserNom(texte);
    lignes = await q(
      `SELECT * FROM equides
        WHERE ($1 <> '' AND sire LIKE $1 || '%') OR ($2 <> '' AND (cle_nom LIKE $2 || '%' OR cle_nom LIKE '% ' || $2 || '%'))
        ORDER BY (cle_nom = $2) DESC, nom LIMIT 50`,
      [s.length >= 3 ? s.replace(/[%_]/g, "") : "", n.length >= 2 ? n.replace(/[%_]/g, "") : ""]
    );
  } else {
    lignes = await q("SELECT * FROM equides ORDER BY maj_le DESC, id DESC LIMIT 20");
  }

  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link> › <Link href="/admin">Administration</Link></div>
        <div className="entete">
          <div>
            <h1>Base équidés</h1>
            <div className="sous">{total.toLocaleString("fr-FR")} équidé(s). Interrogée à l'ajout d'un poney, avec l'API Équidés (fiches publiques IFCE).</div>
          </div>
        </div>

        <FormImportEquides ouvertAuDepart={!total} />

        <section className="section">
          <form method="get" style={{ display: "flex", gap: 8 }}>
            <input type="search" name="q" defaultValue={texte} placeholder="Nom ou numéro SIRE…" />
            <button className="btn">Chercher</button>
          </form>
          <p className="aide">{texte ? `${lignes.length}${lignes.length === 50 ? "+" : ""} résultat(s)` : "Derniers ajouts ou mises à jour"}</p>
          <div className="tableau-wrap">
            <table>
              <thead><tr><th>Nom</th><th>SIRE</th><th>Sexe</th><th>Année</th><th>Race / robe</th><th>Source</th></tr></thead>
              <tbody>
                {lignes.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.nom}</strong>{e.origines && <div className="aide" style={{ marginTop: 2 }}>{e.origines}</div>}{e.proprietaire && <div className="aide" style={{ marginTop: 2 }}>{e.proprietaire}</div>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{e.sire || "—"}</td>
                    <td>{e.sexe || "—"}</td>
                    <td>{e.annee ?? "—"}</td>
                    <td>{[e.race, e.robe].filter(Boolean).join(" · ") || "—"}</td>
                    <td><span className="pastille">{SOURCES[e.source] ?? e.source}</span></td>
                  </tr>
                ))}
                {!lignes.length && <tr><td colSpan={6} className="vide">Aucun équidé.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {total > 0 && (
          <form action={viderEquides} style={{ marginTop: 28 }}>
            <BoutonConfirme message={`Supprimer les ${total} équidés de la base ? Les poneys déjà engagés dans les épreuves ne sont pas touchés.`}>
              Vider la base
            </BoutonConfirme>
          </form>
        )}
      </main>
    </>
  );
}
