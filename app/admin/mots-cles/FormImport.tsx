"use client";

import { useActionState, useRef, useState } from "react";
import { importerMotsCles } from "@/app/actions";

export default function FormImport({ ouvertAuDepart }: { ouvertAuDepart: boolean }) {
  const [etat, action, enCours] = useActionState(importerMotsCles, undefined);
  const [ouvert, setOuvert] = useState(ouvertAuDepart); // reste ouvert après un import, pour voir le résultat
  const form = useRef<HTMLFormElement>(null);
  return (
    <details className="depliant carte" open={ouvert} onToggle={(e) => setOuvert((e.target as HTMLDetailsElement).open)}>
    <summary>Ajouter ou importer</summary>
    <form ref={form} action={action} key={etat?.ok}>
      <label htmlFor="liste">Saisir des mots clés (un par ligne)</label>
      <textarea id="liste" name="liste" rows={5} style={{ minHeight: 0 }}
        placeholder={"dos solide\nallures amples\ntrès bon modèle ; 12"} />
      <p className="aide">Une fréquence initiale peut suivre le mot clé, après un point-virgule.</p>

      <label htmlFor="fichier">ou importer un fichier CSV</label>
      <input id="fichier" name="fichier" type="file" accept=".csv,.txt,text/csv,text/plain" />
      <p className="aide">
        Une colonne « mot clé », et une deuxième colonne « fréquence » facultative. Séparateur point-virgule, virgule ou
        tabulation ; un fichier enregistré depuis Excel convient. Les mots clés déjà présents ne sont pas dupliqués
        (accents et majuscules ignorés) ; leur fréquence est remplacée si le fichier en donne une.
      </p>

      {etat?.erreur && <p className="message erreur">{etat.erreur}</p>}
      {etat?.ok && <p className="message ok">{etat.ok}</p>}
      <div className="actions"><button className="btn" disabled={enCours}>{enCours ? "Import…" : "Ajouter"}</button></div>
    </form>
    </details>
  );
}
