"use client";

import { useActionState, useMemo, useState } from "react";
import { modifierMotCle, supprimerMotCle, viderMotsCles } from "@/app/actions";
import { normaliser } from "@/lib/motscles";

type Mot = { id: number; texte: string; usage: number };

export default function ListeMotsCles({ mots }: { mots: Mot[] }) {
  const [filtre, setFiltre] = useState("");
  const [limite, setLimite] = useState(100);
  const visibles = useMemo(() => {
    const f = normaliser(filtre);
    return f ? mots.filter((m) => normaliser(m.texte).includes(f)) : mots;
  }, [mots, filtre]);

  if (!mots.length) return <p className="vide carte" style={{ marginTop: 16 }}>Aucun mot clé pour l'instant.</p>;
  const max = Math.max(1, ...mots.map((m) => m.usage));

  return (
    <section className="section">
      <h2><span>Liste</span><span className="pastille">{mots.length}</span></h2>
      <input type="search" placeholder="Rechercher…" value={filtre} onChange={(e) => { setFiltre(e.target.value); setLimite(100); }} />
      <ul className="liste" style={{ marginTop: 10 }}>
        {visibles.slice(0, limite).map((m) => <LigneMot key={m.id} m={m} max={max} />)}
        {!visibles.length && <li className="vide">Aucun résultat.</li>}
      </ul>
      {visibles.length > limite && (
        <div className="actions"><button className="btn second plein" onClick={() => setLimite((l) => l + 200)}>Afficher plus ({visibles.length - limite} restants)</button></div>
      )}

      <form action={viderMotsCles} style={{ marginTop: 28 }}>
        <button className="btn danger petit" onClick={(e) => {
          if (!window.confirm(`Supprimer les ${mots.length} mots clés ? Pensez à faire un export CSV avant.`)) e.preventDefault();
        }}>Tout supprimer</button>
      </form>
    </section>
  );
}

function LigneMot({ m, max }: { m: Mot; max: number }) {
  const [etat, action, enCours] = useActionState(modifierMotCle, undefined);
  return (
    <li className="carte" style={{ padding: "10px 14px" }}>
      <details className="depliant">
        <summary style={{ color: "var(--encre)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.texte}</span>
          <span className="jauge" title={`Utilisé ${m.usage} fois`}><span style={{ width: `${Math.round((m.usage / max) * 100)}%` }} /></span>
          <span className="pastille" style={{ minWidth: 36, textAlign: "center" }}>{m.usage}</span>
        </summary>
        <form action={action}>
          <input type="hidden" name="id" value={m.id} />
          <div className="grille2" style={{ gridTemplateColumns: "1fr 110px" }}>
            <div><label>Mot clé</label><input name="texte" defaultValue={m.texte} maxLength={120} required /></div>
            <div><label>Fréquence</label><input name="usage" type="number" min={0} inputMode="numeric" defaultValue={m.usage} /></div>
          </div>
          {etat?.erreur && <p className="message erreur">{etat.erreur}</p>}
          {etat?.ok && <p className="message ok">{etat.ok}</p>}
          <div className="actions">
            <button className="btn petit" disabled={enCours}>Enregistrer</button>
            <button className="btn danger petit" formAction={supprimerMotCle} formNoValidate onClick={(e) => {
              if (!window.confirm(`Supprimer « ${m.texte} » ?`)) e.preventDefault();
            }}>Supprimer</button>
          </div>
        </form>
      </details>
    </li>
  );
}
