"use client";

import { useEffect, useState } from "react";
import type { PhotoVue } from "@/lib/epreuve";

const TAILLE_IMAGE = 1600;   // plus grand côté de l'image envoyée
const TAILLE_MINI = 360;     // vignette

/** Charge une image en respectant l'orientation de l'appareil photo (EXIF). */
async function charger(fichier: File): Promise<{ src: CanvasImageSource; l: number; h: number; liberer: () => void }> {
  try {
    const bmp = await createImageBitmap(fichier, { imageOrientation: "from-image" });
    return { src: bmp, l: bmp.width, h: bmp.height, liberer: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { src: img, l: img.naturalWidth, h: img.naturalHeight, liberer: () => URL.revokeObjectURL(url) };
  }
}

function reduire(src: CanvasImageSource, l: number, h: number, max: number, qualite: number): Promise<{ blob: Blob; l: number; h: number }> {
  const k = Math.min(1, max / Math.max(l, h));
  const cl = Math.max(1, Math.round(l * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = cl; c.height = ch;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, cl, ch);
  return new Promise((ok, ko) =>
    c.toBlob((b) => (b ? ok({ blob: b, l: cl, h: ch }) : ko(new Error("compression"))), "image/jpeg", qualite)
  );
}

export function urlPhoto(id: number, mini = false) {
  return `/api/photos/${id}${mini ? "?t=mini" : ""}`;
}

export default function Photos({
  poneyId, nomPoney, photos, peutAjouter, moiId, estAdmin, onAjout, onRetrait,
}: {
  poneyId: number; nomPoney: string; photos: PhotoVue[]; peutAjouter: boolean; moiId: number; estAdmin: boolean;
  onAjout: (p: PhotoVue) => void; onRetrait: (id: number) => void;
}) {
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<number | null>(null); // index affiché en grand

  async function envoyer(fichiers: FileList | null) {
    const liste = Array.from(fichiers ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    if (!liste.length) return;
    setErreur(null);
    let echecs = 0;
    for (let i = 0; i < liste.length; i++) {
      setEnvoi({ fait: i, total: liste.length });
      try {
        const img = await charger(liste[i]);
        const grande = await reduire(img.src, img.l, img.h, TAILLE_IMAGE, 0.82);
        const mini = await reduire(img.src, img.l, img.h, TAILLE_MINI, 0.72);
        img.liberer();
        const fd = new FormData();
        fd.append("image", grande.blob, "photo.jpg");
        fd.append("miniature", mini.blob, "mini.jpg");
        fd.append("largeur", String(grande.l));
        fd.append("hauteur", String(grande.h));
        const r = await fetch(`/api/poneys/${poneyId}/photos`, { method: "POST", body: fd });
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.erreur ?? String(r.status));
        onAjout((await r.json()).photo);
      } catch {
        echecs++;
      }
    }
    setEnvoi(null);
    if (echecs) {
      setErreur(echecs === liste.length
        ? "Photo non envoyée. Vérifiez la connexion puis réessayez."
        : `${echecs} photo(s) sur ${liste.length} non envoyée(s). Vérifiez la connexion puis réessayez.`);
    }
  }

  async function supprimer(id: number) {
    if (!window.confirm("Supprimer cette photo ?")) return;
    const r = await fetch(`/api/photos/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { setErreur((await r?.json().catch(() => null))?.erreur ?? "Suppression impossible."); return; }
    onRetrait(id);
    setVue((v) => (v == null ? v : photos.length <= 1 ? null : Math.min(v, photos.length - 2)));
  }

  const actuelle = vue != null ? photos[vue] : null;

  return (
    <div className="photos">
      {photos.length > 0 && (
        <ul className="photos-grille">
          {photos.map((ph, i) => (
            <li key={ph.id}>
              <button onClick={() => setVue(i)} aria-label={`Photo ${i + 1} de ${nomPoney}, par ${ph.auteur}`}>
                <img src={urlPhoto(ph.id, true)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!photos.length && !peutAjouter && <p className="aide">Aucune photo.</p>}

      {peutAjouter && (
        <div className="photos-actions">
          <label className={`btn second petit${envoi ? " occupe" : ""}`}>
            <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
            Prendre une photo
            <input type="file" accept="image/*" capture="environment" hidden disabled={!!envoi}
              onChange={(e) => { void envoyer(e.target.files); e.target.value = ""; }} />
          </label>
          <label className={`btn second petit${envoi ? " occupe" : ""}`}>
            <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" />
            </svg>
            Galerie
            <input type="file" accept="image/*" multiple hidden disabled={!!envoi}
              onChange={(e) => { void envoyer(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      )}
      {envoi && <p className="aide">Envoi de la photo {envoi.fait + 1}/{envoi.total}…</p>}
      {erreur && <p className="message erreur">{erreur}</p>}

      {actuelle && (
        <Visionneuse
          id={actuelle.id}
          legende={`${nomPoney} · ${vue! + 1}/${photos.length}${actuelle.auteur ? ` · ${actuelle.auteur}` : ""}`}
          peutSupprimer={estAdmin || actuelle.userId === moiId}
          onSupprimer={() => supprimer(actuelle.id)}
          onPrecedent={vue! > 0 ? () => setVue(vue! - 1) : undefined}
          onSuivant={vue! < photos.length - 1 ? () => setVue(vue! + 1) : undefined}
          onFermer={() => setVue(null)}
        />
      )}
    </div>
  );
}

function Visionneuse({
  id, legende, peutSupprimer, onSupprimer, onPrecedent, onSuivant, onFermer,
}: {
  id: number; legende: string; peutSupprimer: boolean; onSupprimer: () => void;
  onPrecedent?: () => void; onSuivant?: () => void; onFermer: () => void;
}) {
  const [departX, setDepartX] = useState<number | null>(null);

  useEffect(() => {
    // Capture : Échap et flèches pour la visionneuse, sans fermer la fiche du poney derrière
    const clavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onFermer(); }
      else if (e.key === "ArrowLeft" && onPrecedent) onPrecedent();
      else if (e.key === "ArrowRight" && onSuivant) onSuivant();
    };
    window.addEventListener("keydown", clavier, true);
    return () => window.removeEventListener("keydown", clavier, true);
  }, [onFermer, onPrecedent, onSuivant]);

  return (
    <div
      className="visionneuse" role="dialog" aria-modal="true" aria-label="Photo"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
      onTouchStart={(e) => setDepartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (departX == null) return;
        const dx = e.changedTouches[0].clientX - departX;
        if (dx > 60 && onPrecedent) onPrecedent();
        if (dx < -60 && onSuivant) onSuivant();
        setDepartX(null);
      }}
    >
      <img key={id} src={urlPhoto(id)} alt={legende} onClick={(e) => e.stopPropagation()} />
      <div className="visionneuse-barre">
        <span>{legende}</span>
        <span className="visionneuse-boutons">
          {peutSupprimer && <button className="vb danger" onClick={onSupprimer}>Supprimer</button>}
          <button className="vb" onClick={onFermer} aria-label="Fermer">✕</button>
        </span>
      </div>
      {onPrecedent && <button className="vb nav gauche" onClick={onPrecedent} aria-label="Photo précédente">‹</button>}
      {onSuivant && <button className="vb nav droite" onClick={onSuivant} aria-label="Photo suivante">›</button>}
    </div>
  );
}
