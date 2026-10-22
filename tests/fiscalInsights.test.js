import test from 'node:test';
import assert from 'node:assert/strict';
import { fiscalAnswer } from '../src/lib/fiscalInsights.js';
const rows = [
 { contract_number:'CT-100/2026', object:'Material hospitalar', status:'ativo', total_value:1000, used_value:500, end_date:'2099-12-31', fiscal_status:'adequada' },
 { contract_number:'CT-200/2026', object:'Equipamento', status:'ativo', total_value:2000, used_value:1800, end_date:'2099-12-31', fiscal_status:'baixa' },
];
test('resumo mantém aritmética numérica', () => {
 const r=fiscalAnswer('resumo dos contratos',rows);
 assert.ok(r.includes('3.000,00'));
 assert.ok(r.includes('2.300,00'));
});
test('alerta de teto detecta 90% de consumo e saldo', () => {
 const r=fiscalAnswer('quais contratos estão em risco do teto?',rows);
 assert.ok(r.includes('CT-200/2026'));
 assert.ok(r.includes('90.0%'));
 assert.ok(!r.includes('CT-100/2026'));
});
test('consulta por numero inclui saldo especifico', () => {
 const r=fiscalAnswer('fale sobre CT-100/2026',rows);
 assert.ok(r.includes('CT-100/2026'));
 assert.match(r,/500,00/);
});
test('fiscalizacao fraca produz lista', () => {
 const r=fiscalAnswer('fiscalizacao baixa',rows);
 assert.ok(r.includes('CT-200/2026'));
 assert.ok(!r.includes('CT-100/2026'));
});
test('consulta desconhecida delega para IA', () => assert.equal(fiscalAnswer('olá',rows),null));
test('dados vazios não inventam risco', () => assert.match(fiscalAnswer('risco',[]),/nenhum/));
