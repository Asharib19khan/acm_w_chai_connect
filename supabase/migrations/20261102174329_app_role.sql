-- The sites connect as chai_app: rows only (select/insert/update/delete), no schema changes, no
-- truncate, not a superuser. RLS stays on for every table; chai_app is the only role with a policy,
-- so the Data API roles (anon, authenticated) still see nothing. The password is set outside git.

do $$
begin
  if not exists (select from pg_roles where rolname = 'chai_app') then
    create role chai_app login;
  end if;
end $$;

grant usage on schema public to chai_app;
grant select, insert, update, delete on all tables in schema public to chai_app;
grant usage, select on all sequences in schema public to chai_app;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> '_local_migrations' loop
    execute format('create policy chai_app_all on public.%I for all to chai_app using (true) with check (true)', t);
  end loop;
end $$;
