import { permittedAlertUserIds, eligibleAlertRecipients, alertIdempotencyKey } from './alert-delivery.ts';

const u1 = '11111111-1111-4111-8111-111111111111';
const u2 = '22222222-2222-4222-8222-222222222222';
const u3 = '33333333-3333-4333-8333-333333333333';
const u4 = '44444444-4444-4444-8444-444444444444';

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test('only assigned active fiscal and active organization administrators receive alerts', () => {
  const ids = permittedAlertUserIds([
    { user_id: u1, role: 'fiscal', status: 'active' },
    { user_id: u2, role: 'organization_admin', status: 'active' },
    { user_id: u3, role: 'fiscal', status: 'active' },
    { user_id: u4, role: 'organization_admin', status: 'suspended' },
    { user_id: u2, role: 'organization_admin', status: 'active' },
  ], u1);
  check(ids.length === 2 && ids.includes(u1) && ids.includes(u2), 'Unexpected alert recipients');
});

Deno.test('non-fiscal role cannot be included by a stale contract assignment', () => {
  const ids = permittedAlertUserIds([{ user_id: u1, role: 'visualizador', status: 'active' }], u1);
  check(ids.length === 0, 'Unauthorized viewer was accepted as fiscal');
});

Deno.test('eligible recipients require an active profile, allowed id and valid email', () => {
  const recipients = eligibleAlertRecipients([
    { id: u1, email: 'fiscal@example.org', status: 'active' },
    { id: u1, email: 'fiscal@example.org', status: 'active' },
    { id: u2, email: 'admin@example.org', status: 'inactive' },
    { id: u3, email: 'outsider@example.org', status: 'active' },
    { id: u4, email: 'invalid', status: 'active' },
  ], [u1, u2, u4]);
  check(recipients.length === 1 && recipients[0].id === u1, 'Recipient eligibility failed');
});

Deno.test('idempotency keys are stable per alert and user and vary across recipients', () => {
  const alert = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const first = alertIdempotencyKey(alert, u1);
  check(first === alertIdempotencyKey(alert, u1), 'Key must survive retries');
  check(first !== alertIdempotencyKey(alert, u2), 'Different recipients need different keys');
  let rejected = false;
  try { alertIdempotencyKey('not-a-uuid', u1); } catch { rejected = true; }
  check(rejected, 'Malformed identifier accepted');
});
