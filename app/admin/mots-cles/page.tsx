import Link from "next/link";
import { exigerAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import Barre from "@/components/Barre";
import FormImport from "./FormImport";
import ListeMotsCles from "./ListeMotsCles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mots clés" };

export default async function MotsCles() {
  const u = await exigerAdmin();
  const mots = await q<{ id: number; texte: string; usage: number }>(
    "SELECT id, texte, usage FROM mots_cles ORDER BY usage DESC, texte"
  );

  return (
    <>
      <Barre u={u} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link> › <Link href="/admin">Administration</Link></div>
        <div className="entete">
          <div>
            <h1>Mots clés</h1>
            <div className="sous">Proposés en autocomplétion dans les commentaires, du plus utilisé au moins utilisé.</div>
          </div>
          {mots.length > 0 && <a className="btn second petit" href="/api/mots-cles/export">Export CSV</a>}
        </div>

        <FormImport ouvertAuDepart={!mots.length} />

        <ListeMotsCles mots={mots} />
      </main>
    </>
  );
}
