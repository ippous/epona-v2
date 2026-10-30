"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictée vocale via la reconnaissance vocale du navigateur (Web Speech API).
 *
 * Choix pour la fiabilité sur téléphone :
 * - une phrase par session (continuous = false), relancée automatiquement tant que le juge n'a pas arrêté :
 *   le mode continu est instable sur Chrome Android (doublons, arrêts silencieux) et sur Safari iOS ;
 * - l'autorisation du micro est demandée explicitement avant la première écoute ;
 * - chaque erreur est traduite en message clair au lieu d'être ignorée.
 */

const MESSAGES: Record<string, string> = {
  "not-allowed": "Micro refusé. Autorisez le micro pour ce site dans les réglages du navigateur, puis réessayez.",
  "service-not-allowed": "Reconnaissance vocale indisponible. Sur iPhone : Réglages › Général › Clavier › activer la Dictée (et Siri). Ouvrez le site dans Safari plutôt que depuis l'icône de l'écran d'accueil.",
  "audio-capture": "Aucun micro détecté, ou il est déjà utilisé par une autre application.",
  "network": "La dictée a besoin d'une connexion internet.",
  "language-not-supported": "Le français n'est pas disponible pour la dictée sur cet appareil.",
  "bad-grammar": "Erreur de reconnaissance vocale.",
};

type SR = any;
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  // La version préfixée (reconnaissance en ligne, éprouvée sur Chrome Android et Safari iOS) d'abord :
  // la version non préfixée des Chrome récents peut dépendre d'un modèle local absent et rester muette.
  return (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition || null;
}

export function useDictee(surTexte: (texte: string) => void) {
  const [disponible, setDisponible] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [demarrage, setDemarrage] = useState(false);
  const [provisoire, setProvisoire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [silence, setSilence] = useState(false);

  const reco = useRef<SR | null>(null);
  const actif = useRef(false);       // le juge veut dicter (on relance après chaque phrase)
  const echecs = useRef(0);          // relances consécutives sans résultat, pour éviter une boucle
  const rappel = useRef(surTexte);
  rappel.current = surTexte;

  useEffect(() => { setDisponible(!!getSR()); }, []);

  const arreter = useCallback(() => {
    actif.current = false;
    try { reco.current?.stop(); } catch {}
    setEcoute(false);
    setDemarrage(false);
    setProvisoire("");
  }, []);

  const lancerSession = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) return;
    const r: SR = new Ctor();
    r.lang = "fr-FR";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => { setDemarrage(false); setEcoute(true); };
    r.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const t = String(res[0]?.transcript ?? "").trim();
        if (res.isFinal) {
          if (t) { rappel.current(t); echecs.current = 0; setSilence(false); }
        } else {
          interim += res[0]?.transcript ?? "";
        }
      }
      setProvisoire(interim);
    };
    r.onerror = (ev: any) => {
      const code = String(ev?.error || "inconnue");
      if (code === "no-speech") { setSilence(true); return; } // on relance, simple silence
      if (code === "aborted") return;                         // arrêt volontaire
      actif.current = false;
      setErreur(MESSAGES[code] ?? `La dictée s'est arrêtée (erreur « ${code} »).`);
    };
    r.onend = () => {
      setProvisoire("");
      if (actif.current && echecs.current < 8) {
        echecs.current += 1;
        try { r.start(); return; } catch { /* relance impossible : on s'arrête */ }
      }
      actif.current = false;
      setEcoute(false);
      setDemarrage(false);
    };

    reco.current = r;
    // Garde-fou : si le navigateur ne démarre jamais l'écoute, on le dit au lieu de rester bloqué.
    const veille = setTimeout(() => {
      if (reco.current === r && !aDemarre) {
        actif.current = false;
        try { r.abort(); } catch {}
        setDemarrage(false);
        setEcoute(false);
        setErreur("La reconnaissance vocale de ce navigateur ne répond pas. Utilisez le micro du clavier du téléphone, ou ouvrez le site dans Chrome (Android) / Safari (iPhone).");
      }
    }, 6000);
    let aDemarre = false;
    const surDebut = r.onstart;
    r.onstart = () => { aDemarre = true; clearTimeout(veille); surDebut(); };
    try {
      r.start();
    } catch (e: any) {
      clearTimeout(veille);
      actif.current = false;
      setDemarrage(false);
      setErreur(`Impossible de démarrer la dictée (${e?.name || e?.message || "erreur"}).`);
    }
  }, []);

  const demarrer = useCallback(async () => {
    if (!getSR()) return;
    setErreur(null);
    setSilence(false);
    setDemarrage(true);
    echecs.current = 0;

    // Demande explicite du micro : fait apparaître la fenêtre d'autorisation et révèle un refus.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        // Certains navigateurs ne répondent jamais : au-delà de 4 s on tente quand même la reconnaissance.
        const flux = await Promise.race([
          navigator.mediaDevices.getUserMedia({ audio: true }),
          new Promise<null>((r) => setTimeout(() => r(null), 4000)),
        ]);
        flux?.getTracks().forEach((t) => t.stop()); // on libère tout de suite le micro pour la reconnaissance
      } catch (e: any) {
        setDemarrage(false);
        const nom = e?.name || "";
        setErreur(
          nom === "NotAllowedError" || nom === "SecurityError" ? MESSAGES["not-allowed"]
          : nom === "NotFoundError" || nom === "NotReadableError" ? MESSAGES["audio-capture"]
          : `Micro inaccessible (${nom || "erreur"}).`
        );
        return;
      }
    }
    actif.current = true;
    lancerSession();
  }, [lancerSession]);

  useEffect(() => () => { actif.current = false; try { reco.current?.abort(); } catch {} }, []);

  return { disponible, ecoute, demarrage, silence, provisoire, erreur, demarrer, arreter };
}

/** Ajoute une phrase dictée au commentaire existant, avec majuscule et ponctuation simples. */
export function ajouterPhrase(existant: string, phrase: string): string {
  if (!phrase) return existant;
  const p = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const base = existant.trimEnd();
  if (!base) return p;
  const sep = /[.!?…]$/.test(base) ? " " : ". ";
  return base + sep + p;
}
