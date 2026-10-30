import Link from "next/link";

export default function Introuvable() {
  return (
    <main className="connexion">
      <div className="carte" style={{ textAlign: "center" }}>
        <h1>Page introuvable</h1>
        <p style={{ color: "var(--doux)" }}>Cette page n'existe pas ou vous n'y avez pas accès.</p>
        <Link className="btn" href="/">Retour à l'accueil</Link>
      </div>
    </main>
  );
}
