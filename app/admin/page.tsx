import Link from "next/link";
import { exigerAdmin } from "@/lib/auth";
import { q1 } from "@/lib/db";
import Barre from "@/components/Barre";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function Admin() {
  const u = await exigerAdmin();
  const n = await q1<{ comptes: number; mots: number; equides: number }>(
    `SELECT (SELECT count(*)::int FROM utilisateurs WHERE actif) AS comptes,
            (SELECT count(*)::int FROM mots_cles) AS mots,
            (SELECT count(*)::int FROM equides) AS equides`
  );
  const entrees = [
    { href: "/admin/utilisateurs", titre: "Comptes", meta: `${n?.comptes ?? 0} compte(s) actif(s) — juges et administrateurs` },
    { href: "/admin/mots-cles", titre: "Mots clés", meta: `${n?.mots ?? 0} mot(s) clé(s) pour l'autocomplétion des commentaires` },
    { href: "/admin/equides", titre: "Base équidés", meta: `${(n?.equides ?? 0).toLocaleString("fr-FR")} équidé(s) — recherche à l'ajout d'un poney, import CSV / Excel` },
  ];
  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link></div>
        <div className="entete"><h1>Administration</h1></div>
        <ul className="liste">
          {entrees.map((e) => (
            <li key={e.href} className="carte">
              <Link className="ligne-lien" href={e.href}>
                <div><div className="titre">{e.titre}</div><div className="meta">{e.meta}</div></div>
                <span className="chevron">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
