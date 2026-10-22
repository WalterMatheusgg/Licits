// Normalize small generic ERP payloads without vendor-specific assumptions.
// No monetary fields are inferred if absent. A human/ERP remains responsible for correctness.
export type ErpProvider = 'generic' | 'br_publico';
type Data = Record<string, unknown>;
function object(value: unknown): Data {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
}
function first(...values: unknown[]): string {
  return values.find(value => typeof value === 'string' && value.trim())?.toString().trim() || '';
}
function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const raw = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(raw)) {
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+(?:\.\d{1,2})?$/.test(raw)) return Number(raw);
  return NaN;
}
export function normalizeErpContract(provider: ErpProvider, payload: unknown) {
  if (!['generic', 'br_publico'].includes(provider)) throw Error('Provedor não suportado');
  const data = object(payload);
  const supplier = object(data.fornecedor);
  const contract_number = first(data.contract_number, data.numero_contrato, data.numero);
  const contractObject = first(data.object, data.objeto, data.descricao);
  const supplier_name = first(data.supplier_name, supplier.razao_social, data.razao_social);
  const supplier_cnpj = first(data.supplier_cnpj, supplier.cnpj, data.cnpj).replace(/\D/g, '');
  const total_value = parseAmount(data.total_value ?? data.valor_total ?? data.valor_global);
  if (!contract_number || contract_number.length > 100 || !contractObject ||
      contractObject.length > 10000 || !supplier_name || supplier_name.length > 250 ||
      !Number.isFinite(total_value) || total_value < 0 || total_value > 999999999999.99 ||
      (supplier_cnpj && supplier_cnpj.length !== 14)) {
    throw Error('Payload externo incompleto: número, objeto, fornecedor, CNPJ ou valor inválido');
  }
  return {contract_number, object: contractObject, supplier_name, supplier_cnpj, total_value};
}
