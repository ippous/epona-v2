"use client";

import { useActionState } from "react";
import { connexion } from "@/app/actions";

export default function FormConnexion() {
  const [etat, action, enCours] = useActionState(connexion, undefined);
  return (
    <form action={action}>
      <label htmlFor="login">Identifiant</label>
      <input id="login" name="login" autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
      <label htmlFor="mdp">Mot de passe</label>
      <input id="mdp" name="mot_de_passe" type="password" autoComplete="current-password" required />
      {etat?.erreur && <p className="message erreur" role="alert">{etat.erreur}</p>}
      <div className="actions">
        <button className="btn plein" disabled={enCours}>{enCours ? "Connexion…" : "Se connecter"}</button>
      </div>
    </form>
  );
}
