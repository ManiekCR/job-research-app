-- A single LLM config row per user (allows a clean "upsert": saving again
-- replaces the old config rather than creating a second one).
alter table llm_credentials
  add constraint llm_credentials_user_id_key unique (user_id);