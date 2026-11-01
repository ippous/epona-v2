/**
 * Mots clés : normalisation et moteur d'autocomplétion (partagé client / serveur).
 * La comparaison ignore la casse et les accents : « tres bon » propose « Très bon ».
 */

export type MotCle = { id: number; texte: string; usage: number };
export type Suggestion = { mot: MotCle; debut: number };

export const LONGUEUR_MAX = 120;

/** Nettoie un mot clé saisi : espaces superflus retirés, longueur bornée. */
export function nettoyer(texte: string): string {
  return texte.replace(/\s+/g, " ").trim().slice(0, LONGUEUR_MAX);
}

/** Clé de comparaison : minuscules, sans accents, espaces simples. */
export function normaliser(texte: string): string {
  return nettoyer(texte).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const SEPARATEURS = /[.,;:!?…()\n]/;

/**
 * Suggestions pour le texte et la position du curseur.
 * - En cours de mot : mots clés qui commencent par les derniers mots tapés (jusqu'à 4 mots),
 *   puis ceux dont un mot commence par le fragment ; triés par fréquence d'usage.
 * - Après une espace ou un signe de ponctuation : les mots clés les plus utilisés, à insérer au curseur.
 */
export function suggerer(texte: string, curseur: number, mots: MotCle[], max = 8): { fragment: string; items: Suggestion[] } {
  const avant = texte.slice(0, curseur);
  let debutSegment = 0;
  for (let i = avant.length - 1; i >= 0; i--) {
    if (SEPARATEURS.test(avant[i])) { debutSegment = i + 1; break; }
  }
  const segment = avant.slice(debutSegment);
  const enCoursDeMot = segment.length > 0 && !/\s$/.test(segment);
  const mots_ = [...segment.matchAll(/\S+/g)];

  if (!enCoursDeMot || !mots_.length) {
    const top = [...mots].sort((a, b) => b.usage - a.usage || a.texte.localeCompare(b.texte, "fr")).slice(0, max);
    return { fragment: "", items: top.map((mot) => ({ mot, debut: curseur })) };
  }

  // Fins possibles : le dernier mot, les deux derniers, … (pour les expressions de plusieurs mots)
  const fins: { debut: number; cle: string }[] = [];
  for (let k = Math.min(4, mots_.length); k >= 1; k--) {
    const debut = debutSegment + mots_[mots_.length - k].index!;
    fins.push({ debut, cle: normaliser(avant.slice(debut)) });
  }
  const dernier = fins[fins.length - 1];
  // Au moins 2 caractères tapés au total (« tres b » suffit pour « très bon modèle »)
  if (!fins.some((f) => f.cle.length >= 2)) return { fragment: dernier.cle, items: [] };

  const trouves: { mot: MotCle; debut: number; rang: number }[] = [];
  for (const mot of mots) {
    const cle = normaliser(mot.texte);
    if (fins.some((f) => f.cle === cle)) continue; // déjà tapé en entier
    let ok = false;
    for (const f of fins) {
      if (f.cle.length >= 2 && cle.startsWith(f.cle) && cle !== f.cle) {
        trouves.push({ mot, debut: f.debut, rang: 0 });
        ok = true;
        break;
      }
    }
    if (!ok && dernier.cle.length >= 2 && cle.split(" ").some((w) => w.startsWith(dernier.cle))) {
      trouves.push({ mot, debut: dernier.debut, rang: 1 });
    }
  }
  trouves.sort((a, b) => a.rang - b.rang || b.mot.usage - a.mot.usage || a.mot.texte.length - b.mot.texte.length);
  return { fragment: dernier.cle, items: trouves.slice(0, max).map(({ mot, debut }) => ({ mot, debut })) };
}

/** Insère la suggestion choisie : remplace le fragment tapé, gère majuscule et espaces. */
export function appliquer(texte: string, curseur: number, s: Suggestion): { texte: string; curseur: number } {
  const avant = texte.slice(0, s.debut);
  let apres = texte.slice(curseur);
  // Curseur au milieu d'un mot : la fin du mot est remplacée elle aussi
  if (s.debut < curseur) apres = apres.slice((apres.match(/^[^\s.,;:!?…()]+/)?.[0] ?? "").length);
  const precedent = avant.trimEnd();
  let mot = s.mot.texte;
  if (!precedent || /[.!?…]$/.test(precedent)) mot = mot.charAt(0).toUpperCase() + mot.slice(1);
  const prefixe = avant && !/\s$/.test(avant) ? " " : "";
  const suffixe = /^[\s,.;:!?)]/.test(apres) ? "" : " ";
  const debut = avant + prefixe + mot + suffixe;
  return { texte: debut + apres, curseur: debut.length };
}
