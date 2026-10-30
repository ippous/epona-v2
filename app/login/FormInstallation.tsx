"use client";

import { useActionState } from "react";
import { creerPremierAdmin } from "@/app/actions";

export default function FormInstallation() {
  const [etat, action, enCours] = useActionState(creerPremierAdmin, undefined);
  return (
    <form action={action}>
      <p className="message ok">Première ouverture : créez le compte administrateur.</p>
      <label htmlFor="login">Identifiant</label>
      <input id="login" name="login" autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
      <label htmlFor="nom">Nom affiché</label>
      <input id="nom" name="nom" placeholder="ex. E. Jaume" />
      <label htmlFor="mdp">Mot de passe (10 caractères min.)</label>
      <input id="mdp" name="mot_de_passe" type="password" autoComplete="new-password" minLength={10} required />
      <label htmlFor="mdp2">Confirmation</label>
      <input id="mdp2" name="confirmation" type="password" autoComplete="new-password" minLength={10} required />
      {etat?.erreur && <p className="message erreur" role="alert">{etat.erreur}</p>}
      <div className="actions">
        <button className="btn plein" disabled={enCours}>{enCours ? "Création…" : "Créer et se connecter"}</button>
      </div>
    </form>
  );
}
