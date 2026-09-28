-- A single profile (master CV) per user, to allow a clean upsert.
alter table profile
  add constraint profile_user_id_key unique (user_id);