"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import type { EpreuveVue, PoneyVue } from "@/lib/epreuve";
import { couleurNiveau } from "@/lib/format";
import { useDictee, ajouterPhrase } from "./useDictee";
import "./jugement.css";

type Patch = { niveau?: string | null; commentaire?: string };
type Statut = "ok" | "envoi" | "erreur";

const INTERVALLE_SYNCHRO = 5000;

export default function Jugement({ initial, estJure, estAdmin }: { initial: EpreuveVue; estJure: boolean; estAdmin: boolean }) {
  const [vue, setVue] = useState<EpreuveVue>(initial);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [statut, setStatut] = useState<Statut>("ok");
  const [annonce, setAnnonce] = useState<string | null>(null);

  const enAttente = useRef(new Map<number, Patch>()); // jugements pas encore confirmés par le serveur
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reclassementEnCours = useRef(false);
  const glisse = useRef(false);
  const versionRef = useRef(initial.version);
  versionRef.current = vue.version;

  const niveaux = vue.niveaux;
  const lectureSeule = !estJure;

  const montrer = useCallback((m: string) => {
    setAnnonce(m);
    setTimeout(() => setAnnonce((a) => (a === m ? null : a)), 3500);
  }, []);

  /* ---------- Envoi des jugements ---------- */

  const vider = useCallback(async () => {
    if (tempo.current) { clearTimeout(tempo.current); tempo.current = null; }
    const lots = [...enAttente.current.entries()];
    if (!lots.length) return;
    setStatut("envoi");
    let echec = false;
    for (const [id, patch] of lots) {
      try {
        const r = await fetch(`/api/poneys/${id}/jugement`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
        });
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (!r.ok) throw new Error(String(r.status));
        // Ne retirer que si rien de nouveau n'a été saisi pendant l'envoi
        if (enAttente.current.get(id) === patch) enAttente.current.delete(id);
      } catch {
        echec = true;
      }
    }
    setStatut(echec ? "erreur" : enAttente.current.size ? "envoi" : "ok");
  }, []);

  const juger = useCallback((poneyId: number, patch: Patch, immediat: boolean) => {
    const prec = enAttente.current.get(poneyId) ?? {};
    enAttente.current.set(poneyId, { ...prec, ...patch });
    setVue((v) => ({
      ...v,
      poneys: v.poneys.map((p) => (p.id === poneyId ? { ...p, moi: { ...p.moi, ...patch } as PoneyVue["moi"] } : p)),
    }));
    setStatut("envoi");
    if (tempo.current) clearTimeout(tempo.current);
    tempo.current = setTimeout(vider, immediat ? 0 : 800);
  }, [vider]);

  /* ---------- Synchronisation avec les autres juges ---------- */

  const synchroniser = useCallback(async () => {
    if (glisse.current || reclassementEnCours.current) return;
    try {
      const r = await fetch(`/api/epreuves/${initial.id}`, { cache: "no-store" });
      if (r.status === 401) { window.location.href = "/login"; return; }
      if (!r.ok) return;
      const neuf: EpreuveVue = await r.json();
      if (glisse.current || reclassementEnCours.current) return;
      if (neuf.version !== versionRef.current && neuf.modifiePar) {
        montrer(`Classement mis à jour par ${neuf.modifiePar}`);
      }
      // Les saisies locales non encore confirmées restent prioritaires
      const poneys = neuf.poneys.map((p) => {
        const att = enAttente.current.get(p.id);
        return att ? { ...p, moi: { ...p.moi, ...att } as PoneyVue["moi"] } : p;
      });
      setVue({ ...neuf, poneys });
      if (enAttente.current.size) vider(); // nouvel essai après une coupure réseau
    } catch {
      /* hors ligne : on réessaiera */
    }
  }, [initial.id, montrer, vider]);

  useEffect(() => {
    const t = setInterval(synchroniser, INTERVALLE_SYNCHRO);
    const auRetour = () => { if (document.visibilityState === "visible") synchroniser(); else vider(); };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("online", synchroniser);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("online", synchroniser);
    };
  }, [synchroniser, vider]);

  /* ---------- Classement ---------- */

  const reclasser = useCallback(async (nouvelOrdre: PoneyVue[]) => {
    const precedent = vue.poneys;
    setVue((v) => ({ ...v, poneys: nouvelOrdre.map((p, i) => ({ ...p, rang: i + 1 })) }));
    reclassementEnCours.current = true;
    try {
      const r = await fetch(`/api/epreuves/${initial.id}/ordre`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordre: nouvelOrdre.map((p) => p.id), version: versionRef.current }),
      });
      if (r.ok) {
        const { version } = await r.json();
        setVue((v) => ({ ...v, version, modifiePar: null }));
      } else {
        const msg = (await r.json().catch(() => null))?.erreur ?? "Classement non enregistré.";
        setVue((v) => ({ ...v, poneys: precedent }));
        montrer(r.status === 409 ? `${msg} Vérifiez l'ordre puis recommencez.` : msg);
      }
    } catch {
      setVue((v) => ({ ...v, poneys: precedent }));
      montrer("Pas de réseau : classement non enregistré.");
    } finally {
      reclassementEnCours.current = false;
      synchroniser();
    }
  }, [vue.poneys, initial.id, montrer, synchroniser]);

  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const finGlisse = (e: DragEndEvent) => {
    glisse.current = false;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = vue.poneys.findIndex((p) => p.id === active.id);
    const vers = vue.poneys.findIndex((p) => p.id === over.id);
    if (navigator.vibrate) navigator.vibrate(10);
    reclasser(arrayMove(vue.poneys, de, vers));
  };

  const deplacer = (poneyId: number, delta: number) => {
    const i = vue.poneys.findIndex((p) => p.id === poneyId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= vue.poneys.length) return;
    reclasser(arrayMove(vue.poneys, i, j));
  };

  /* ---------- Rendu ---------- */

  const nbJuges = vue.poneys.filter((p) => p.moi.niveau).length;
  const indexOuvert = vue.poneys.findIndex((p) => p.id === ouvert);
  const poneyOuvert = indexOuvert >= 0 ? vue.poneys[indexOuvert] : null;
  const ids = useMemo(() => vue.poneys.map((p) => p.id), [vue.poneys]);

  return (
    <main className="page jugement">
      <div className="fil">
        {estAdmin ? <Link href={`/concours/${vue.concoursId}`}>{vue.concours}</Link> : <Link href="/">{vue.concours}</Link>}
      </div>
      <div className="entete">
        <div>
          <h1>{vue.titre}</h1>
          <div className="sous">
            {estJure ? <>{nbJuges}/{vue.poneys.length} jugés · </> : null}
            Jury : {vue.juges.map((j) => j.nom).join(", ") || "—"}
          </div>
        </div>
        <Link className="btn second petit" href={`/epreuve/${vue.id}/resultats`}>Résultats</Link>
      </div>

      {lectureSeule && (
        <p className="message erreur">Vous n'êtes pas membre du jury de cette épreuve : consultation seule.</p>
      )}

      {!vue.poneys.length ? (
        <p className="vide carte">Aucun poney engagé dans cette épreuve.</p>
      ) : (
        <>
          {!lectureSeule && <p className="aide" style={{ margin: "0 0 10px" }}>Glissez la poignée ⠿ pour classer. Touchez un poney pour le juger.</p>}
          <DndContext
            sensors={capteurs}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={() => { glisse.current = true; }}
            onDragCancel={() => { glisse.current = false; }}
            onDragEnd={finGlisse}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="classement">
                {vue.poneys.map((p, i) => (
                  <CartePoney
                    key={p.id} p={p} rang={i + 1} niveaux={niveaux} nbJury={vue.juges.length}
                    peutGlisser={!lectureSeule} onOuvrir={() => setOuvert(p.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </>
      )}

      {poneyOuvert && (
        <Feuille
          key={poneyOuvert.id}
          p={poneyOuvert}
          rang={indexOuvert + 1}
          total={vue.poneys.length}
          niveaux={niveaux}
          lectureSeule={lectureSeule}
          statut={statut}
          onNiveau={(n) => juger(poneyOuvert.id, { niveau: n }, true)}
          onCommentaire={(c, immediat) => juger(poneyOuvert.id, { commentaire: c }, immediat)}
          onDeplacer={(d) => deplacer(poneyOuvert.id, d)}
          onPrecedent={indexOuvert > 0 ? () => { vider(); setOuvert(vue.poneys[indexOuvert - 1].id); } : undefined}
          onSuivant={indexOuvert < vue.poneys.length - 1 ? () => { vider(); setOuvert(vue.poneys[indexOuvert + 1].id); } : undefined}
          onFermer={() => { vider(); setOuvert(null); }}
        />
      )}

      <div className={`etat-envoi ${statut}`} aria-live="polite">
        {statut === "envoi" ? "Enregistrement…" : statut === "erreur" ? "Hors ligne – vos saisies seront renvoyées" : ""}
      </div>
      {annonce && <div className="annonce" role="status">{annonce}</div>}
    </main>
  );
}

/* ================= Carte d'un poney dans le classement ================= */

function CartePoney({
  p, rang, niveaux, nbJury, peutGlisser, onOuvrir,
}: { p: PoneyVue; rang: number; niveaux: string[]; nbJury: number; peutGlisser: boolean; onOuvrir: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id, disabled: !peutGlisser });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const iNiv = p.moi.niveau ? niveaux.indexOf(p.moi.niveau) : -1;
  const coul = iNiv >= 0 ? couleurNiveau(iNiv, niveaux.length) : null;
  const avisAutres = p.autres.filter((a) => a.niveau);

  return (
    <li ref={setNodeRef} style={style} className={`poney${isDragging ? " glisse" : ""}`}>
      {peutGlisser && (
        <button ref={setActivatorNodeRef} className="poignee" aria-label={`Déplacer ${p.nom}, rang ${rang}`} {...attributes} {...listeners}>
          ⠿
        </button>
      )}
      <button className="corps" onClick={onOuvrir}>
        <span className="rang">{rang}</span>
        <span className="infos">
          <span className="nom">{p.numero != null && <span className="num">n°{p.numero}</span>}{p.nom}</span>
          {p.moi.commentaire ? <span className="extrait">{p.moi.commentaire}</span> : <span className="extrait vide-com">Pas de commentaire</span>}
        </span>
        <span className="droite">
          {coul ? (
            <span className="niv" style={{ background: coul.fond, color: coul.texte }}>{p.moi.niveau}</span>
          ) : (
            <span className="niv a-juger">À juger</span>
          )}
          {nbJury > 1 && (
            <span className="points" title={`${avisAutres.length} autre(s) juge(s) ont donné un niveau`}>
              {avisAutres.map((a) => {
                const c = couleurNiveau(niveaux.indexOf(a.niveau!), niveaux.length);
                return <span key={a.userId} style={{ background: c.fond }} />;
              })}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/* ================= Feuille de jugement (plein écran sur mobile) ================= */

function Feuille({
  p, rang, total, niveaux, lectureSeule, statut, onNiveau, onCommentaire, onDeplacer, onPrecedent, onSuivant, onFermer,
}: {
  p: PoneyVue; rang: number; total: number; niveaux: string[]; lectureSeule: boolean; statut: Statut;
  onNiveau: (n: string | null) => void; onCommentaire: (c: string, immediat: boolean) => void;
  onDeplacer: (delta: number) => void; onPrecedent?: () => void; onSuivant?: () => void; onFermer: () => void;
}) {
  const [texte, setTexte] = useState(p.moi.commentaire);
  const texteRef = useRef(texte);
  texteRef.current = texte;

  const dictee = useDictee((phrase) => {
    const t = ajouterPhrase(texteRef.current, phrase);
    setTexte(t);
    onCommentaire(t, false);
  });

  // Bloque le défilement de la page derrière la feuille ; Échap ferme
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const clavier = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", clavier);
    return () => { document.body.style.overflow = avant; window.removeEventListener("keydown", clavier); dictee.arreter(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="voile" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <section className="feuille" role="dialog" aria-modal="true" aria-label={`Jugement de ${p.nom}`}>
        <header className="feuille-tete">
          <div>
            <div className="feuille-rang">Rang {rang} / {total}{p.numero != null && <> · n°{p.numero}</>}</div>
            <h2>{p.nom}</h2>
            {(p.sire || p.proprietaire) && <div className="aide" style={{ marginTop: 2 }}>{[p.sire, p.proprietaire].filter(Boolean).join(" · ")}</div>}
          </div>
          <button className="fermer" onClick={onFermer} aria-label="Fermer">✕</button>
        </header>

        <div className="feuille-corps">
          <div className="titre-bloc">Niveau</div>
          <div className="niveaux" role="radiogroup" aria-label="Niveau">
            {niveaux.map((n, i) => {
              const c = couleurNiveau(i, niveaux.length);
              const choisi = p.moi.niveau === n;
              return (
                <button
                  key={n} role="radio" aria-checked={choisi} disabled={lectureSeule}
                  className={`choix-niveau${choisi ? " choisi" : ""}`}
                  style={choisi ? { background: c.fond, borderColor: c.fond, color: c.texte } : { borderColor: c.fond }}
                  onClick={() => onNiveau(choisi ? null : n)}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="titre-bloc">
            Commentaire
            <span className={`statut-${statut}`}>{statut === "envoi" ? "…" : statut === "erreur" ? "non envoyé" : "enregistré ✓"}</span>
          </div>
          <div className="zone-com">
            <textarea
              value={texte}
              readOnly={lectureSeule}
              placeholder={lectureSeule ? "" : "Touchez le micro pour dicter, ou écrivez…"}
              onChange={(e) => { setTexte(e.target.value); onCommentaire(e.target.value, false); }}
              onBlur={() => { if (texte !== p.moi.commentaire) onCommentaire(texte, true); }}
            />
            {dictee.provisoire && <div className="provisoire">{dictee.provisoire}…</div>}
          </div>
          {!lectureSeule && (
            dictee.disponible ? (
              <button className={`micro${dictee.ecoute ? " actif" : ""}`} onClick={dictee.ecoute ? dictee.arreter : dictee.demarrer}>
                <svg className="micro-icone" aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
                </svg>
                {dictee.ecoute ? "J'écoute… toucher pour arrêter" : "Dicter le commentaire"}
              </button>
            ) : (
              <p className="aide">Dictée intégrée non disponible sur ce navigateur : utilisez le micro du clavier de votre téléphone.</p>
            )
          )}
          {dictee.erreur && <p className="message erreur">{dictee.erreur}</p>}

          {p.autres.length > 0 && (
            <details className="depliant autres">
              <summary>Avis des autres juges ({p.autres.length})</summary>
              <ul>
                {p.autres.map((a) => {
                  const i = a.niveau ? niveaux.indexOf(a.niveau) : -1;
                  const c = i >= 0 ? couleurNiveau(i, niveaux.length) : null;
                  return (
                    <li key={a.userId}>
                      <strong>{a.juge}</strong>{" "}
                      {c ? <span className="niv" style={{ background: c.fond, color: c.texte }}>{a.niveau}</span> : <span className="niv a-juger">pas de niveau</span>}
                      {a.commentaire && <p>{a.commentaire}</p>}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>

        <footer className="feuille-pied">
          {!lectureSeule && (
            <div className="deplacer">
              <button className="btn second petit" disabled={rang === 1} onClick={() => onDeplacer(-1)} aria-label="Monter d'un rang">▲ Monter</button>
              <button className="btn second petit" disabled={rang === total} onClick={() => onDeplacer(1)} aria-label="Descendre d'un rang">▼ Descendre</button>
            </div>
          )}
          <div className="navigation">
            <button className="btn second" disabled={!onPrecedent} onClick={onPrecedent}>‹ Précédent</button>
            <button className="btn" disabled={!onSuivant} onClick={onSuivant}>Suivant ›</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
