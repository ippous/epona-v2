"use client";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="connexion">
      <div className="carte" style={{ textAlign: "center" }}>
        <h1>Un problème est survenu</h1>
        <p style={{ color: "var(--doux)" }}>
          Le service est momentanément indisponible. Réessayez dans un instant ; si le problème persiste, prévenez l'administrateur.
        </p>
        {error.digest && <p className="aide">Référence : {error.digest}</p>}
        <button className="btn" onClick={reset}>Réessayer</button>
      </div>
    </main>
  );
}
