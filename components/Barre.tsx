import Link from "next/link";
import type { Utilisateur } from "@/lib/auth";
import { deconnexion } from "@/app/actions";

const NOM = process.env.NEXT_PUBLIC_APP_NAME || "Epona v2";

export default function Barre({ u }: { u: Utilisateur }) {
  return (
    <header className="barre">
      <Link href="/" className="marque">
        <img src="/icon.svg" alt="" width={26} height={26} />
        {NOM}
      </Link>
      <span className="espace" />
      {u.role === "ADMIN" && (
        <Link href="/admin/utilisateurs" className="lien-barre">Comptes</Link>
      )}
      <form action={deconnexion}>
        <button className="lien-barre" style={{ background: "none", border: 0, color: "#fff", font: "inherit", cursor: "pointer" }} title={`Connecté : ${u.nom || u.login}`}>
          Quitter
        </button>
      </form>
    </header>
  );
}
