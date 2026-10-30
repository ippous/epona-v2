// Schéma de la base, partagé par l'appli et le script de démonstration.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS parametres (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id            SERIAL PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL DEFAULT '',
  mot_de_passe  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('ADMIN','JUGE')),
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concours (
  id         SERIAL PRIMARY KEY,
  titre      TEXT NOT NULL,
  date_debut DATE,
  date_fin   DATE,
  lieu       TEXT NOT NULL DEFAULT '',
  cree_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epreuves (
  id            SERIAL PRIMARY KEY,
  concours_id   INT NOT NULL REFERENCES concours(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  niveaux       JSONB NOT NULL DEFAULT '["Sans Qualification","A Revoir","Excellent","Très Excellent"]',
  ordre         INT NOT NULL DEFAULT 0,
  rang_version  INT NOT NULL DEFAULT 0,
  rang_par      INT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  rang_le       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS jury (
  epreuve_id INT NOT NULL REFERENCES epreuves(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  PRIMARY KEY (epreuve_id, user_id)
);

CREATE TABLE IF NOT EXISTS poneys (
  id           SERIAL PRIMARY KEY,
  epreuve_id   INT NOT NULL REFERENCES epreuves(id) ON DELETE CASCADE,
  numero       INT,
  nom          TEXT NOT NULL,
  sire         TEXT NOT NULL DEFAULT '',
  proprietaire TEXT NOT NULL DEFAULT '',
  rang         INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS poneys_epreuve_idx ON poneys(epreuve_id, rang);

CREATE TABLE IF NOT EXISTS jugements (
  poney_id    INT NOT NULL REFERENCES poneys(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  niveau      TEXT,
  commentaire TEXT NOT NULL DEFAULT '',
  modifie_le  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poney_id, user_id)
);
`;
