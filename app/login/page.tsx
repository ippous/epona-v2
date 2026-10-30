import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import FormConnexion from "./FormConnexion";

export const metadata = { title: "Connexion" };

export default async function PageConnexion() {
  if (await utilisateurCourant()) redirect("/");
  return (
    <main className="connexion">
      <div className="carte">
        <div className="logo"><img src="/icon.svg" alt="" width={56} height={56} /></div>
        <h1>{process.env.NEXT_PUBLIC_APP_NAME || "Jury"}</h1>
        <p style={{ textAlign: "center", color: "var(--doux)", margin: "0 0 8px" }}>Espace des juges</p>
        <FormConnexion />
      </div>
    </main>
  );
}
