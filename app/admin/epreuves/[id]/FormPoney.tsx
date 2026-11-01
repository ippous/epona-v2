"use client";

import { useEffect, useRef, useState } from "react";
import "./form-poney.css";

export type ValeursPoney = {
  numero: string; nom: string; sire: string; proprietaire: string;
  sexe: string; annee: string; race: string; robe: string; origines: string; ifce_id: string;
};
type Resultat = {
  nom: string; sire: string; sexe: string; annee: number | null; race: string; robe: string;
  origines: string; proprietaire: string; source: "base" | "ifce"; ifceId?: string; complet: boolean;
};
type Etat =
  | { phase: "ferme" }
  | { phase: "recherche"; mode: "nom" | "sire" }
  | { phase: "liste"; mode: "nom" | "sire"; resultats: Resultat[]; apiJoignable: boolean; apiInterrogee: boolean; explicite: boolean };

const VIDE: ValeursPoney = { numero: "", nom: "", sire: "", proprietaire: "", sexe: "", annee: "", race: "", robe: "", origines: "", ifce_id: "" };

export default function FormPoney({
  action, cachés, initial, libelle,
}: {
  action: (fd: FormData) => void | Promise<void>;
  cachés: Record<string, string | number>;
  initial?: Partial<ValeursPoney>;
  libelle: string;
}) {
  const [v, setV] = useState<ValeursPoney>({ ...VIDE, ...initial });
  const [etat, setEtat] = useState<Etat>({ phase: "ferme" });
  const [actif, setActif] = useState(-1);
  const [info, setInfo] = useState<string | null>(null);
  const [details, setDetails] = useState(!!(initial?.race || initial?.origines || initial?.robe));
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requete = useRef<AbortController | null>(null);
  const boite = useRef<HTMLDivElement>(null);

  const maj = (k: keyof ValeursPoney, val: string) => setV((x) => ({ ...x, [k]: val }));

  async function chercher(texte: string, mode: "nom" | "sire", explicite: boolean) {
    const t = texte.trim();
    if (t.length < (mode === "sire" ? 3 : 2)) {
      if (explicite) setInfo(mode === "sire" ? "Saisissez au moins 3 caractères du SIRE." : "Saisissez au moins 2 lettres du nom.");
      setEtat({ phase: "ferme" });
      return;
    }
    requete.current?.abort();
    const ctrl = new AbortController();
    requete.current = ctrl;
    setInfo(null);
    setEtat({ phase: "recherche", mode });
    try {
      const r = await fetch(`/api/equides/recherche?mode=${mode}&q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
      if (r.status === 401) { window.location.href = "/login"; return; }
      const j = await r.json();
      setActif(-1);
      setEtat({ phase: "liste", mode, resultats: j.resultats ?? [], apiJoignable: j.apiJoignable !== false, apiInterrogee: !!j.apiInterrogee, explicite });
    } catch (e: any) {
      if (e?.name !== "AbortError") { setEtat({ phase: "ferme" }); setInfo("Recherche impossible : vérifiez la connexion."); }
    }
  }

  // Autocomplétion du nom pendant la frappe
  function surNom(val: string) {
    maj("nom", val);
    maj("ifce_id", "");
    if (tempo.current) clearTimeout(tempo.current);
    if (val.trim().length < 2) { requete.current?.abort(); setEtat({ phase: "ferme" }); return; }
    tempo.current = setTimeout(() => chercher(val, "nom", false), 300);
  }

  async function choisir(r: Resultat) {
    let f = r;
    if (r.source === "ifce" && !r.complet && r.ifceId) {
      setEtat({ phase: "recherche", mode: "nom" });
      try {
        const rep = await fetch(`/api/equides/ifce/${encodeURIComponent(r.ifceId)}`);
        if (rep.ok) f = await rep.json();
      } catch { /* on garde le résumé */ }
    }
    setV((x) => ({
      ...x,
      nom: f.nom || x.nom,
      sire: f.sire || x.sire,
      proprietaire: f.proprietaire || x.proprietaire,
      sexe: f.sexe || "", annee: f.annee ? String(f.annee) : "",
      race: f.race || "", robe: f.robe || "", origines: f.origines || "",
      ifce_id: f.source === "ifce" ? f.ifceId ?? "" : "",
    }));
    if (f.race || f.origines || f.robe) setDetails(true);
    setEtat({ phase: "ferme" });
    setInfo(f.source === "ifce" && !f.sire ? "Infos reprises de l'IFCE. Le numéro SIRE n'y figure pas : complétez-le si besoin." : "Infos reprises de notre base.");
  }

  // Sur téléphone, la liste peut s'ouvrir sous le bas de l'écran : on la ramène dans la vue
  useEffect(() => {
    if (etat.phase !== "liste") return;
    const l = boite.current?.querySelector(".fp-liste");
    if (l) requestAnimationFrame(() => l.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [etat]);

  // Fermer la liste en touchant ailleurs
  useEffect(() => {
    if (etat.phase === "ferme") return;
    const dehors = (e: PointerEvent) => { if (!boite.current?.contains(e.target as Node)) setEtat({ phase: "ferme" }); };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [etat.phase]);

  const clavier = (e: React.KeyboardEvent) => {
    if (etat.phase !== "liste" || !etat.resultats.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(i + 1, etat.resultats.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && actif >= 0) { e.preventDefault(); void choisir(etat.resultats[actif]); }
    else if (e.key === "Escape") setEtat({ phase: "ferme" });
  };

  const liste = etat.phase === "ferme" ? null : (
          <div className="fp-liste" role="listbox">
            {etat.phase === "recherche" ? (
              <div className="fp-msg">Recherche{etat.mode === "nom" ? " dans notre base et l'API Équidés" : " dans notre base"}…</div>
            ) : (
              <>
                {etat.resultats.map((r, i) => (
                  <button
                    key={`${r.source}-${r.sire || r.ifceId || r.nom}-${i}`} type="button" role="option" aria-selected={i === actif}
                    className={`fp-item${i === actif ? " actif" : ""}`}
                    onMouseEnter={() => setActif(i)} onClick={() => choisir(r)}
                  >
                    <span className="fp-ligne1">
                      <strong>{r.nom}</strong>
                      <span className={`fp-src ${r.source}`}>{r.source === "base" ? "Notre base" : "IFCE"}</span>
                    </span>
                    <span className="fp-ligne2">{[r.sire, r.sexe, r.annee, r.race, r.robe].filter(Boolean).join(" · ") || "—"}</span>
                    {r.proprietaire && <span className="fp-ligne2">{r.proprietaire}</span>}
                  </button>
                ))}
                {!etat.resultats.length && (etat.explicite || etat.mode === "nom") && (
                  <div className="fp-msg">
                    {etat.mode === "sire"
                      ? "SIRE inconnu de notre base. L'API Équidés publique ne contient pas les numéros SIRE : cherchez par nom."
                      : "Aucun équidé trouvé."}
                  </div>
                )}
                {etat.apiInterrogee && !etat.apiJoignable && (
                  <div className="fp-msg">API Équidés injoignable pour le moment : résultats de notre base uniquement.</div>
                )}
              </>
            )}
          </div>
  );

  const loupe = (
    <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
    </svg>
  );

  return (
    <form action={action} className="form-poney">
      {Object.entries(cachés).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <input type="hidden" name="ifce_id" value={v.ifce_id} />

      <div className="fp-recherche" ref={boite}>
        <div className="grille-fp">
          <div className="fp-num">
            <label>N°</label>
            <input name="numero" inputMode="numeric" value={v.numero} onChange={(e) => maj("numero", e.target.value)} />
          </div>
          <div className="fp-champ">
            <label>Nom</label>
            <div className="champ-loupe">
              <input
                name="nom" required autoComplete="off" autoCapitalize="characters" value={v.nom}
                role="combobox" aria-expanded={etat.phase === "liste"} aria-autocomplete="list"
                onChange={(e) => surNom(e.target.value)} onKeyDown={clavier}
                onFocus={() => { if (v.nom.trim().length >= 2 && etat.phase === "ferme" && !v.ifce_id) void chercher(v.nom, "nom", false); }}
              />
              <button type="button" className="loupe" aria-label="Rechercher par nom" onClick={() => chercher(v.nom, "nom", true)}>{loupe}</button>
            </div>
            {etat.phase !== "ferme" && etat.mode === "nom" && liste}
          </div>
        </div>

        <div className="fp-champ">
        <label>SIRE</label>
        <div className="champ-loupe">
          <input name="sire" autoComplete="off" autoCapitalize="characters" value={v.sire}
            onChange={(e) => maj("sire", e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void chercher(v.sire, "sire", true); } else clavier(e); }} />
          <button type="button" className="loupe" aria-label="Rechercher par SIRE" onClick={() => chercher(v.sire, "sire", true)}>{loupe}</button>
        </div>
        {etat.phase !== "ferme" && etat.mode === "sire" && liste}
        </div>

      </div>
      {info && <p className="aide">{info}</p>}

      <label>Propriétaire</label>
      <input name="proprietaire" value={v.proprietaire} onChange={(e) => maj("proprietaire", e.target.value)} />

      <div className="grille2">
        <div>
          <label>Sexe</label>
          <select name="sexe" value={v.sexe} onChange={(e) => maj("sexe", e.target.value)}>
            <option value="">—</option>
            <option>Femelle</option><option>Mâle</option><option>Hongre</option>
            {v.sexe && !["Femelle", "Mâle", "Hongre"].includes(v.sexe) && <option>{v.sexe}</option>}
          </select>
        </div>
        <div>
          <label>Année de naissance</label>
          <input name="annee" inputMode="numeric" maxLength={4} value={v.annee} onChange={(e) => maj("annee", e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>

      {details ? (
        <>
          <div className="grille2">
            <div><label>Race</label><input name="race" value={v.race} onChange={(e) => maj("race", e.target.value)} /></div>
            <div><label>Robe</label><input name="robe" value={v.robe} onChange={(e) => maj("robe", e.target.value)} /></div>
          </div>
          <label>Origines (père × mère)</label>
          <input name="origines" value={v.origines} onChange={(e) => maj("origines", e.target.value)} />
        </>
      ) : (
        <>
          <input type="hidden" name="race" value={v.race} />
          <input type="hidden" name="robe" value={v.robe} />
          <input type="hidden" name="origines" value={v.origines} />
          <button type="button" className="lien-plus" onClick={() => setDetails(true)}>+ Race, robe, origines</button>
        </>
      )}

      <div className="actions"><button className="btn">{libelle}</button></div>
    </form>
  );
}
