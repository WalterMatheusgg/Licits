import { json, options, authorize, member } from '../_shared/security.ts';
// Authenticated, read-only, organization-scoped integration endpoint.
// Integrators authenticate as an invited organization member using a Supabase access token.
Deno.serve(async req => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    const { admin, user } = await authorize(req);
    const body = await req.json();
    const organization_id = String(body.organization_id || '');
    if (!/^[a-f0-9-]{36}$/i.test(organization_id)) return json({ error: 'Organização inválida' }, 400);
    const membership = await member(admin, user.id, organization_id);
    const operation = String(body.operation || 'list');
    if (operation === 'create') {
      if (!['organization_admin', 'gestor'].includes(membership.role)) {
        return json({error:'Acesso de escrita restrito ao administrador ou gestor'}, 403);
      }
      const item = body.contract || {};
      const contract_number = String(item.contract_number || '').trim();
      const object = String(item.object || '').trim();
      const supplier_name = String(item.supplier_name || '').trim();
      const amount = Number(item.total_value);
      if (!contract_number || contract_number.length > 100 || !object || object.length > 10000 ||
          !supplier_name || supplier_name.length > 250 || !Number.isFinite(amount) || amount < 0) {
        return json({error:'Informe número, objeto, fornecedor e valor total válido'},400);
      }
      const cnpj = String(item.supplier_cnpj || '').replace(/\\D/g,'');
      if (cnpj && cnpj.length !== 14) return json({error:'CNPJ deve conter 14 dígitos'},400);
      const old = await admin.from('contracts').select('id').eq('organization_id',organization_id)
        .eq('contract_number',contract_number).is('deleted_at',null).maybeSingle();
      if (old.error) throw old.error;
      if (old.data) return json({error:'Contrato com este número já existe',contract_id:old.data.id},409);
      let supplierQuery = admin.from('suppliers').select('id').eq('organization_id',organization_id).is('deleted_at',null);
      supplierQuery = cnpj ? supplierQuery.eq('cnpj',cnpj) : supplierQuery.eq('legal_name',supplier_name);
      const supplierResult = await supplierQuery.limit(1);
      if (supplierResult.error) throw supplierResult.error;
      let supplierId = supplierResult.data?.[0]?.id;
      if (!supplierId) {
        const inserted = await admin.from('suppliers').insert({
          organization_id,created_by:user.id,legal_name:supplier_name,cnpj:cnpj||null
        }).select('id').single();
        if (inserted.error) throw inserted.error;
        supplierId = inserted.data.id;
      }
      const created = await admin.from('contracts').insert({
        organization_id, created_by:user.id, supplier_id:supplierId,
        contract_number, object, total_value:amount,
        status:'em_analise'
      }).select('id,contract_number,status,total_value').single();
      if (created.error) throw created.error;
      return json({api_version:'v1',data:created.data},201);
    }
    if (operation !== 'list') return json({error:'Operação não suportada'},400);
    const page = Math.max(1, Math.min(10000, Math.floor(Number(body.page) || 1)));
    const per_page = Math.max(1, Math.min(100, Math.floor(Number(body.per_page) || 25)));
    const offset = (page - 1) * per_page;
    const result = await admin.from('contracts')
      .select('id,contract_number,object,status,start_date,end_date,total_value,used_value,updated_at', { count: 'exact' })
      .eq('organization_id', organization_id).is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + per_page - 1);
    if (result.error) throw result.error;
    return json({
      api_version: 'v1',
      organization_id,
      data: result.data || [],
      pagination: { page, per_page, total: result.count ?? 0,
        total_pages: Math.ceil((result.count ?? 0) / per_page) },
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    // No raw internal credential or provider response is returned.
    return json({error: /Sessão|Faça login/.test(message) ? 'Não autenticado' : message}, 400);
  }
});
