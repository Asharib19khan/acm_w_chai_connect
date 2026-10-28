-- Smoke test: proves the pgTAP pipeline runs. Real rule tests arrive in phase P2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select ok(true, 'pgTAP runs');
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and rowsecurity = false),
  0,
  'every public table has RLS enabled'
);

select * from finish();
rollback;
