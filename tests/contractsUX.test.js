import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contractStatuses, contractStatusLabel, contractStatusDescription } from '../src/lib/contractStatus.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('every database contract status has a clear visible description', () => {
  const values = ['ativo','vencido','encerrado','suspenso','cancelado','em_analise','em_analise_slic'];
  assert.deepEqual(contractStatuses.map(s => s.value).sort(), values.sort());
  for (const value of values) {
    assert.notEqual(contractStatusLabel(value), value);
    assert.ok(contractStatusDescription(value).length >= 15);
  }
});
test('contract list separates archived contracts from price registrations', () => {
  const list = read('src/pages/Contracts.jsx');
  assert.match(list, /showArchived/);
  assert.match(list, /dataClient\.contracts\.listArchived/);
  assert.match(list, /Arquivar/);
  assert.match(list, /Ver histórico/);
  assert.match(list, /\/price-registrations/);
  assert.doesNotMatch(list, /typeFilter/);
  assert.doesNotMatch(list, /Novo Registro de Preços/);
});
test('contract details expose a status confirmation and read-only timeline', () => {
  const detail = read('src/pages/ContractDetail.jsx');
  assert.match(detail, /Alterar situação/);
  assert.match(detail, /statusMutation\.mutate\(nextStatus\)/);
  assert.match(detail, /value="history"/);
  assert.match(detail, /<ContractHistory contractId=\{contractId\}/);
  assert.match(detail, /isManager &&/);
});
test('timeline supports pagination and does not display raw audit record contents', () => {
  const timeline = read('src/components/contracts/ContractHistory.jsx');
  assert.match(timeline, /useInfiniteQuery/);
  assert.match(timeline, /Carregar histórico anterior/);
  assert.doesNotMatch(timeline, /JSON\.stringify\(entry\.old_data/);
});
test('contract status and audit queries are both tenant scoped', () => {
  const api = read('src/api/dataClient.js');
  const migration = read('supabase/migrations/20261024190225_contract_history_and_archive_queries.sql');
  assert.match(api, /p_organization_id: ctx\.org/);
  assert.match(migration, /public\.can_manage_contracts\(p_organization_id\)/);
  assert.match(migration, /public\.is_organization_member\(p_organization_id\)/);
  assert.match(migration, /revoke all on function public\.get_contract_history/);
});
