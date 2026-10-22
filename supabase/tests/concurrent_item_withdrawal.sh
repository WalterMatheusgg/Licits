#!/usr/bin/env bash
set -euo pipefail

DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  psql "$DB" -v ON_ERROR_STOP=1 -c "
    delete from public.audit_logs where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.item_withdrawals where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.notifications where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.contract_items where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.contracts where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.suppliers where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.organization_members where organization_id='d1000000-0000-4000-8000-000000000002';
    delete from public.organizations where id='d1000000-0000-4000-8000-000000000002';
    delete from auth.users where id='d1000000-0000-4000-8000-000000000001';
  " >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/concurrent_item_withdrawal_setup.sql

purchase() {
  local order_id="$1"
  psql "$DB" -v ON_ERROR_STOP=1 -c "
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
    select pg_sleep(0.2);
    select public.register_item_withdrawal(
      'd1000000-0000-4000-8000-000000000002',
      'd1000000-0000-4000-8000-000000000005',60,'$order_id'
    );
    commit;
  "
}

purchase CONCURRENT-A >"$TMP_DIR/a.log" 2>&1 &
pid_a=$!
purchase CONCURRENT-B >"$TMP_DIR/b.log" 2>&1 &
pid_b=$!
status_a=0
status_b=0
wait "$pid_a" || status_a=$?
wait "$pid_b" || status_b=$?

if [[ "$status_a" -eq "$status_b" ]]; then
  cat "$TMP_DIR/a.log" "$TMP_DIR/b.log"
  echo "Expected exactly one concurrent purchase to succeed" >&2
  exit 1
fi

psql "$DB" -v ON_ERROR_STOP=1 <<'SQL'
do $check$
begin
  if (select count(*) from public.item_withdrawals
      where organization_id='d1000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'Concurrent withdrawals were not serialized';
  end if;
  if (select used_qty from public.contract_items
      where id='d1000000-0000-4000-8000-000000000005') <> 60 then
    raise exception 'Item balance does not match the one successful withdrawal';
  end if;
  if (select used_value from public.contracts
      where id='d1000000-0000-4000-8000-000000000004') <> 600 then
    raise exception 'Contract balance does not match the one successful withdrawal';
  end if;
end
$check$;
SQL
echo "Concurrent item withdrawal serialized: one success, one rejected."