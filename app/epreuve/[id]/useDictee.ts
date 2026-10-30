"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dictée vocale via la reconnaissance vocale du navigateur (Web Speech API).
 * Fonctionne sur Chrome Android et Safari iOS ; ailleurs, `disponible` vaut false
 * et le juge peut toujours utiliser le micro du clavier de son téléphone.
 */
export function useDictee(surTexte: (texte: string) => void) {
  const [disponible, setDisponible] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [provisoire, setProvisoire] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const reco = useRef<any>(null);
  const actif = useRef(false); // l'utilisateur veut dicter (on relance si le navigateur coupe)
  const rappel = useRef(surTexte);
  rappel.current = surTexte;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setDisponible(!!SR);
  }, []);

  const arreter = useCallback(() => {
    actif.current = false;
    try { reco.current?.stop(); } catch {}
    setEcoute(false);
    setProvisoire("");
  }, []);

  const demarrer = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setErreur(null);
    const r = new SR();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) rappel.current(res[0].transcript.trim());
        else interim += res[0].transcript;
      }
      setProvisoire(interim);
    };
    r.onerror = (ev: any) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setErreur("Micro refusé : autorisez-le dans les réglages du navigateur.");
        actif.current = false;
      } else if (ev.error === "network") {
        setErreur("Dictée indisponible sans connexion.");
        actif.current = false;
      }
    };
    r.onend = () => {
      setProvisoire("");
      // Android coupe après un silence : on relance tant que le juge n'a pas arrêté.
      if (actif.current) {
        try { r.start(); return; } catch {}
      }
      setEcoute(false);
    };
    reco.current = r;
    actif.current = true;
    try {
      r.start();
      setEcoute(true);
    } catch {
      actif.current = false;
    }
  }, []);

  useEffect(() => () => { actif.current = false; try { reco.current?.abort(); } catch {} }, []);

  return { disponible, ecoute, provisoire, erreur, demarrer, arreter };
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
