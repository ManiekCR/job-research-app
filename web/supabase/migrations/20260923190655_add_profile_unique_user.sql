-- Un seul profil (CV maître) par utilisateur, pour permettre un upsert propre.
alter table profile
  add constraint profile_user_id_key unique (user_id);