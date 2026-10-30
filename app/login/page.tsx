import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { existeAdmin } from "@/lib/db";
import FormConnexion from "./FormConnexion";
import FormInstallation from "./FormInstallation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion" };

export default async function PageConnexion() {
  if (await utilisateurCourant()) redirect("/");
  const installe = await existeAdmin();
  return (
    <main className="connexion">
      <div className="carte">
        <div className="logo"><img src="/icon.svg" alt="" width={56} height={56} /></div>
        <h1>{process.env.NEXT_PUBLIC_APP_NAME || "Epona v2"}</h1>
        <p style={{ textAlign: "center", color: "var(--doux)", margin: "0 0 8px" }}>Espace des juges</p>
        {installe ? <FormConnexion /> : <FormInstallation />}
      </div>
    </main>
  );
}
