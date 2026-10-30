"use client";

import { useActionState } from "react";
import { creerUtilisateur } from "@/app/actions";

export default function FormNouveauCompte() {
  const [etat, action, enCours] = useActionState(creerUtilisateur, undefined);
  return (
    <form action={action} key={etat?.ok}>
      <div className="grille2">
        <div><label>Identifiant</label><input name="login" autoCapitalize="none" autoCorrect="off" required /></div>
        <div><label>Nom affiché</label><input name="nom" placeholder="ex. C. Martin" /></div>
        <div><label>Mot de passe</label><input name="mot_de_passe" type="password" autoComplete="new-password" minLength={8} required /></div>
        <div>
          <label>Rôle</label>
          <select name="role" defaultValue="JUGE">
            <option value="JUGE">Juge</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
      </div>
      {etat?.erreur && <p className="message erreur">{etat.erreur}</p>}
      {etat?.ok && <p className="message ok">{etat.ok}</p>}
      <div className="actions"><button className="btn" disabled={enCours}>Créer le compte</button></div>
    </form>
  );
}
