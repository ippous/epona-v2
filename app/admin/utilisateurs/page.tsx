import Link from "next/link";
import { exigerAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import Barre from "@/components/Barre";
import { modifierUtilisateur } from "@/app/actions";
import FormNouveauCompte from "./FormNouveauCompte";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comptes" };

export default async function Comptes({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const moi = await exigerAdmin();
  const ok = Number((await searchParams).ok);
  const comptes = await q<{ id: number; login: string; nom: string; role: string; actif: boolean }>(
    "SELECT id, login, nom, role, actif FROM utilisateurs ORDER BY actif DESC, nom, login"
  );

  return (
    <>
      <Barre u={moi} />
      <main className="page">
        <div className="fil"><Link href="/">Accueil</Link></div>
        <div className="entete"><div><h1>Comptes</h1><div className="sous">Juges et administrateurs</div></div></div>

        <details className="depliant carte">
          <summary>Nouveau compte</summary>
          <FormNouveauCompte />
        </details>

        <ul className="liste" style={{ marginTop: 16 }}>
          {comptes.map((c) => (
            <li key={c.id} className="carte" style={c.actif ? undefined : { opacity: 0.6 }}>
              <details className="depliant">
                <summary style={{ color: "var(--encre)" }}>
                  {c.nom || c.login}{" "}
                  <span style={{ color: "var(--doux)", fontWeight: 400 }}>· {c.login}</span>{" "}
                  {c.role === "ADMIN" && <span className="pastille">admin</span>}{" "}
                  {!c.actif && <span className="pastille">désactivé</span>}
                  {ok === c.id && <span className="pastille" style={{ marginLeft: 6 }}>enregistré ✓</span>}
                </summary>
                <form action={modifierUtilisateur}>
                  <input type="hidden" name="id" value={c.id} />
                  <label>Nom affiché</label>
                  <input name="nom" defaultValue={c.nom} />
                  {c.id !== moi.id && (
                    <>
                      <label>Rôle</label>
                      <select name="role" defaultValue={c.role}>
                        <option value="JUGE">Juge</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                      <label className="coche" style={{ marginTop: 8 }}>
                        <input type="checkbox" name="actif" defaultChecked={c.actif} /> Compte actif
                      </label>
                    </>
                  )}
                  <label>Nouveau mot de passe</label>
                  <input name="mot_de_passe" type="password" autoComplete="new-password" minLength={8} placeholder="laisser vide pour ne pas changer" />
                  <div className="actions"><button className="btn petit">Enregistrer</button></div>
                </form>
              </details>
            </li>
          ))}
        </ul>
        <p className="aide">Un compte désactivé ne peut plus se connecter mais ses jugements sont conservés.</p>
      </main>
    </>
  );
}
