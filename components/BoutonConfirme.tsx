"use client";

/** Bouton de soumission qui demande une confirmation avant une action destructive. */
export default function BoutonConfirme({
  message, children, className = "btn danger petit",
}: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
