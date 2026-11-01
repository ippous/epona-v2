"use client";

import { useActionState, useState } from "react";
import { importerEquides } from "@/app/actions";

export default function FormImportEquides({ ouvertAuDepart }: { ouvertAuDepart: boolean }) {
  const [etat, action, enCours] = useActionState(importerEquides, undefined);
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  return (
    <details className="depliant carte" open={ouvert} onToggle={(e) => setOuvert((e.target as HTMLDetailsElement).open)}>
      <summary>Importer un fichier</summary>
      <form action={action} key={etat?.ok}>
        <label htmlFor="fichier-eq">Fichier CSV ou Excel (.xlsx)</label>
        <input id="fichier-eq" name="fichier" type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        <p className="aide">
          Colonnes reconnues par leur en-tête : SIRE (ou Num SIRE, UELN), Nom, Sexe, Année de naissance, Race, Robe, Père, Mère,
          Origines, Propriétaire. Sans en-tête, l'ordre de l'export « Base SIRE » d'Epona est utilisé : SIRE, Nom, Sexe, Année.
          Un équidé déjà présent (même SIRE) est complété, pas dupliqué. 4 Mo maximum.
        </p>
        {etat?.erreur && <p className="message erreur">{etat.erreur}</p>}
        {etat?.ok && <p className="message ok">{etat.ok}</p>}
        <div className="actions"><button className="btn" disabled={enCours}>{enCours ? "Import en cours…" : "Importer"}</button></div>
      </form>
    </details>
  );
}
