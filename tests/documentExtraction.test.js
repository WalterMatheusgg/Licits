import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContractFields } from '../src/lib/documentExtraction.js';

test('extracts contract metadata, dates, clauses and tabular items from text', () => {
  const result = extractContractFields(`
    CONTRATO ADMINISTRATIVO Nº 123/2026
    Objeto: fornecimento de equipamentos de informática para unidades públicas.
    Contratada: ACME Tecnologia Ltda.
    CNPJ: 12.345.678/0001-90
    Vigência: de 01/02/2026 a 31/01/2027
    Valor global do contrato: R$ 1.234,56
    A fiscalização deverá acompanhar a execução e registrar as ocorrências.
    1. Teclado USB 10 unidade R$ 25,50
  `);

  assert.equal(result.contract_number, '123/2026');
  assert.match(result.object, /equipamentos de informática/);
  assert.equal(result.supplier_name, 'ACME Tecnologia Ltda');
  assert.equal(result.supplier_cnpj, '12345678000190');
  assert.equal(result.start_date, '2026-02-01');
  assert.equal(result.end_date, '2027-01-31');
  assert.equal(result.total_value, 1234.56);
  assert.match(result.clauses[0], /fiscalização/);
  assert.equal(result.items[0].description, 'Teclado USB');
  assert.equal(result.items[0].quantity, 10);
  assert.equal(result.items[0].unit_price, 25.5);
});