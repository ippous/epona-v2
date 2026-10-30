# Epona v2 — jugement de concours de poneys

Application web pensée pour le téléphone : les juges attribuent un **niveau** (liste propre à chaque épreuve, par défaut *Sans Qualification / A Revoir / Excellent / Très Excellent*), rédigent ou **dictent un commentaire**, et établissent ensemble un **classement commun** en glissant les poneys.

## Fonctionnement

- **Concours → Épreuves → Poneys engagés**, comme Epona.
- **Niveaux** : définis par épreuve (un par ligne, du plus faible au meilleur).
- **Jury** : désigné par épreuve. Seuls ses membres jugent et classent ; un admin hors jury consulte.
- **Jugement** : un niveau + un commentaire global par poney et par juge, enregistrés automatiquement. Les autres juges voient les avis dans « Avis des autres juges ».
- **Classement commun** : glisser la poignée ⠿, ou boutons Monter / Descendre dans la fiche. Les écrans se synchronisent toutes les 5 s ; si deux juges reclassent en même temps, le second est prévenu au lieu d'écraser le premier.
- **Dictée** : reconnaissance vocale du navigateur (Chrome Android, Safari iOS), en français. Sinon, le micro du clavier du téléphone fonctionne.
- **Résultats** par épreuve, export CSV pour Excel.
- **Hors réseau** : les saisies restent en attente et sont renvoyées au retour de la connexion.
- Installable sur l'écran d'accueil (manifeste PWA).

## Lancer en local

```bash
npm install
npm run seed      # facultatif : données de démo (juges cmartin / plefevre / adurand, mot de passe jury2026!)
npm run dev       # http://localhost:3000 — compte admin / admin
```

Sans `DATABASE_URL`, une base Postgres embarquée (PGlite) est créée dans `.pglite/`. Arrêter l'appli avant `npm run seed`.

## Déployer sur Vercel + Neon

1. Importer le dépôt dans Vercel.
2. Onglet **Storage** → créer une base **Neon** et la relier au projet (`DATABASE_URL` est ajoutée automatiquement).
3. Redéployer, puis ouvrir l'appli : la première visite propose de **créer le compte administrateur**. Le faire tout de suite après la mise en ligne.

Rien d'autre à configurer : le schéma est créé au premier accès et le secret de session est généré puis conservé en base.
Variables facultatives (voir `.env.example`) : `SESSION_SECRET` pour imposer le secret, `ADMIN_LOGIN` / `ADMIN_PASSWORD` pour créer l'admin sans passer par l'écran d'installation, `NEXT_PUBLIC_APP_NAME` pour le nom affiché.

## Technique

Next.js 15 (App Router), Postgres (Neon / PGlite), sessions JWT en cookie HttpOnly, mots de passe bcrypt, glisser-déposer `@dnd-kit`. En-têtes de sécurité (HSTS, nosniff, X-Frame-Options, Permissions-Policy) dans `next.config.mjs`.
