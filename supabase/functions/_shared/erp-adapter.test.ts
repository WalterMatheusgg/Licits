import { normalizeErpContract } from './erp-adapter.ts';
function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
Deno.test('normaliza ERP em português com valor decimal', () => {
  const value = normalizeErpContract('br_publico', {
    numero_contrato: '005/2026',
    objeto: 'Aquisição de papel',
    fornecedor: { razao_social: 'Papelaria Exemplo', cnpj: '12.345.678/0001-90' },
    valor_total: 'R$ 12.345,67',
  });
  check(value.contract_number === '005/2026', 'Número de contrato incorreto');
  check(value.total_value === 12345.67, 'Valor incorreto');
  check(value.supplier_cnpj === '12345678000190', 'CNPJ incorreto');
});
Deno.test('valor brasileiro sem milhares é aceito', () => {
  const value = normalizeErpContract('generic', {
    contract_number: 'A-1', object: 'Teste', supplier_name: 'Fornecedor',
    total_value: '1234,56',
  });
  check(value.total_value === 1234.56, 'Valor decimal sem milhares incorreto');
});
Deno.test('não inventa fornecedor ausente', () => {
  let rejected = false;
  try { normalizeErpContract('generic', {numero:'3',objeto:'Teste',valor_total:100}); }
  catch { rejected = true; }
  check(rejected, 'Fornecedor obrigatório foi aceito');
});
Deno.test('rejeita valores monetários ambíguos', () => {
  let rejected = false;
  try { normalizeErpContract('generic', {numero:'3',objeto:'Teste',razao_social:'Empresa',valor_total:'1.234'}); }
  catch { rejected = true; }
  check(rejected, 'Valor ambíguo foi aceito');
});
