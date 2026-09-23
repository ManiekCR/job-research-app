-- Une seule ligne de configuration LLM par utilisateur (permet un "upsert" propre :
-- enregistrer à nouveau remplace l'ancienne config plutôt que d'en créer une deuxième).
alter table llm_credentials
  add constraint llm_credentials_user_id_key unique (user_id);