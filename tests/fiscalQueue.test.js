import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFiscalQueue } from '../src/lib/fiscalQueue.js';

test('builds a priority queue and resolution history', () => {
  const { pending, resolved } = buildFiscalQueue({
    today: '2026-10-22',
    contracts: [
      { id: 'contract-1', contract_number: 'CT-1', status: 'ativo', end_date: '2026-10-25', total_value: 100, used_value: 100 },
    ],
    records: [
      { id: 'record-1', contract_id: 'contract-1', status: 'pendente', priority: 'alta', due_date: '2026-10-20', description: 'Vistoria pendente' },
      { id: 'record-2', contract_id: 'contract-1', status: 'concluido', description: 'Vistoria concluída', comments: 'Resolvido', signed_at: '2026-10-21' },
    ],
    occurrences: [
      { id: 'occurrence-1', contract_id: 'contract-1', status: 'aberta', severity: 'critica', title: 'Falha grave', due_date: '2026-10-24' },
      { id: 'occurrence-2', contract_id: 'contract-1', status: 'resolvida', title: 'Falha corrigida', resolution: 'Equipe substituída', resolved_at: '2026-10-22' },
    ],
  });

  assert.equal(pending[0].id, 'record-1');
  assert.equal(pending.some(task => task.id === 'occurrence-1'), true);
  assert.equal(pending.some(task => task.id === 'contract-1-budget'), true);
  assert.equal(pending.some(task => task.id === 'contract-1-expiry'), true);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].history, 'Equipe substituída');
});