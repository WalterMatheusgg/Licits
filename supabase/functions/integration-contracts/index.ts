import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, options, authorize, member, env, readJson, errorResponse } from '../_shared/security.ts';
import { normalizeErpContract } from '../_shared/erp-adapter.ts';
const contractStatuses = ['ativo', 'vencido', 'encerrado', 'suspenso', 'cancelado', 'em_analise', 'em_analise_slic'];
const contractFields = new Set([
  'contract_number', 'sei_number', 'auction_number', 'object', 'status', 'start_date', 'end_date',
  'total_value', 'modality', 'contract_type', 'responsible_sector', 'can_extend', 'extensions_done',
  'max_extensions', 'fiscal_status', 'notes',
]);
const isDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// User-authenticated, role-gated and organization-scoped contract integration endpoint.
// Integrators authenticate as an invited organization member using a Supabase access token.
Deno.serve(async req => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    const accessToken = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '')?.[1] || '';
    let admin: any;
    let user: any = null;
    let credential: any = null;
    if (accessToken.startsWith('lct_')) {
      admin = createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accessToken));
      const tokenHash = Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,'0')).join('');
      const found = await admin.from('integration_credentials')
        .select('id,organization_id,scopes,expires_at').eq('token_hash',tokenHash).is('revoked_at',null).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data || (found.data.expires_at && Date.parse(found.data.expires_at) <= Date.now())) {
        return json({error:'Credencial inválida ou expirada'},401);
      }
      credential = found.data;
      const quota = await admin.rpc('claim_integration_request', {p_credential_id: credential.id});
      if (quota.error) throw quota.error;
      if (quota.data !== true) return json({error:'Limite de 60 requisições por minuto excedido'},429);
      const organization = await admin.from('organizations').select('status,deleted_at')
        .eq('id',credential.organization_id).maybeSingle();
      if (organization.error || organization.data?.status !== 'active' || organization.data?.deleted_at) {
        return json({error:'Organização inacessível'},403);
      }
      const used = await admin.from('integration_credentials').update({last_used_at:new Date().toISOString()})
        .eq('id',credential.id);
      if (used.error) throw used.error;
    } else {
      const authorized = await authorize(req);
      admin = authorized.admin;
      user = authorized.user;
    }
    const body = await readJson(req);
    const organization_id = String(body.organization_id || '');
    if (!/^[a-f0-9-]{36}$/i.test(organization_id)) return json({ error: 'Organização inválida' }, 400);
    const operation = String(body.operation || 'list');
    if (credential && credential.organization_id !== organization_id) return json({error:'Credencial vinculada a outra organização'},403);
    const membership = user ? await member(admin,user.id,organization_id) : null;
    const canWrite = credential
      ? credential.scopes.includes('contracts:write')
      : ['organization_admin','gestor'].includes(membership?.role);

    if (operation === 'create_credential' || operation === 'revoke_credential') {
      if (credential || !['organization_admin','gestor'].includes(membership?.role)) {
        return json({error:'Somente administrador ou gestor pode gerenciar credenciais'},403);
      }
      if (operation === 'create_credential') {
        const name = String(body.name || '').trim();
        const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes)] : ['contracts:read'];
        if (!name || name.length > 100 || !scopes.length || scopes.some((scope:unknown) => typeof scope !== 'string' || !['contracts:read','contracts:write'].includes(scope))) {
          return json({error:'Nome e escopos válidos são obrigatórios'},400);
        }
        let expiresAt: string | null = null;
        if (body.expires_at) {
          const expires = Date.parse(String(body.expires_at));
          if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 366 * 86400000) {
            return json({error:'A expiração deve ser futura e de até um ano'},400);
          }
          expiresAt = new Date(expires).toISOString();
        }
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const token = 'lct_' + Array.from(bytes,byte => byte.toString(16).padStart(2,'0')).join('');
        const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
        const tokenHash = Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,'0')).join('');
        const inserted = await admin.rpc('create_integration_credential',{
          p_organization_id:organization_id,p_user_id:user.id,p_name:name,
          p_token_hash:tokenHash,p_scopes:scopes,p_expires_at:expiresAt,
        });
        if (inserted.error) throw inserted.error;
        return json({api_version:'v1',data:{...inserted.data,token}},201);
      }
      const credentialId = String(body.credential_id || '');
      if (!/^[a-f0-9-]{36}$/i.test(credentialId)) return json({error:'Credencial inválida'},400);
      const revoked = await admin.rpc('revoke_integration_credential',{
        p_organization_id:organization_id,p_user_id:user.id,p_credential_id:credentialId,
      });
      if (revoked.error) throw revoked.error;
      return json({api_version:'v1',data:revoked.data});
    }
    if (operation === 'create' || operation === 'ingest') {
      if (!canWrite) {
        return json({error:'Acesso de escrita restrito ao administrador ou gestor'}, 403);
      }
      let item: Record<string, unknown>;
      if (operation === 'ingest') {
        const provider = String(body.provider || 'generic');
        if (!['generic', 'br_publico'].includes(provider)) return json({error:'Provedor não suportado'},400);
        try { item = normalizeErpContract(provider as 'generic' | 'br_publico', body.payload); }
        catch { return json({error:'Payload de integração inválido'},400); }
      } else {
        item = body.contract || {};
      }
      const contract_number = String(item.contract_number || '').trim();
      const object = String(item.object || '').trim();
      const supplier_name = String(item.supplier_name || '').trim();
      const amount = Number(item.total_value);
      if (!contract_number || contract_number.length > 100 || !object || object.length > 10000 ||
          !supplier_name || supplier_name.length > 250 || !Number.isFinite(amount) || amount < 0) {
        return json({error:'Informe número, objeto, fornecedor e valor total válido'},400);
      }
      const cnpj = String(item.supplier_cnpj || '').replace(/\D/g,'');
      if (cnpj && cnpj.length !== 14) return json({error:'CNPJ deve conter 14 dígitos'},400);
      const created = await admin.rpc('create_integrated_contract',{
        p_organization_id:organization_id,
        p_user_id:user?.id || null,
        p_contract_number:contract_number,
        p_object:object,
        p_supplier_name:supplier_name,
        p_supplier_cnpj:cnpj || null,
        p_total_value:amount,
      });
      if (created.error?.code === '23505') {
        if (operation === 'ingest') {
          const existing = await admin.from('contracts').select('id,contract_number,object,total_value,supplier:suppliers(legal_name,cnpj)')
            .eq('organization_id',organization_id).eq('contract_number',contract_number)
            .is('deleted_at',null).maybeSingle();
          if (existing.error) throw existing.error;
          if (existing.data && existing.data.object === object &&
              Number(existing.data.total_value) === amount &&
              existing.data.supplier?.legal_name === supplier_name &&
              (existing.data.supplier?.cnpj || '') === cnpj) {
            return json({api_version:'v1',data:{id:existing.data.id,contract_number},already_exists:true});
          }
        }
        return json({error:'Contrato com este número já existe'},409);
      }
      if (created.error) throw created.error;
      return json({api_version:'v1',data:created.data},201);
    }
    if (operation === 'update') {
      if (!canWrite) {
        return json({error:'Acesso de escrita restrito ao administrador ou gestor'}, 403);
      }
      const contractId = String(body.contract_id || '');
      if (!/^[a-f0-9-]{36}$/i.test(contractId)) return json({error:'Contrato inválido'},400);
      const updates = body.updates;
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return json({error:'Informe os campos a atualizar'},400);
      }
      const keys = Object.keys(updates);
      if (!keys.length || keys.some(key => !contractFields.has(key))) {
        return json({error:'Campos de atualização inválidos'},400);
      }
      if ('contract_number' in updates &&
          (typeof updates.contract_number !== 'string' || !updates.contract_number.trim() || updates.contract_number.length > 100)) {
        return json({error:'Número do contrato inválido'},400);
      }
      if ('object' in updates &&
          (typeof updates.object !== 'string' || !updates.object.trim() || updates.object.length > 10000)) {
        return json({error:'Objeto do contrato inválido'},400);
      }
      if ('status' in updates && !contractStatuses.includes(updates.status)) {
        return json({error:'Status inválido'},400);
      }
      if ('total_value' in updates && (!Number.isFinite(Number(updates.total_value)) || Number(updates.total_value) < 0)) {
        return json({error:'Valor total inválido'},400);
      }
      for (const key of ['start_date', 'end_date']) {
        if (key in updates && updates[key] !== null && !isDate(updates[key])) {
          return json({error:`${key} deve estar no formato AAAA-MM-DD`},400);
        }
      }
      if ('contract_number' in updates) {
        const number = updates.contract_number.trim();
        const duplicate = await admin.from('contracts').select('id').eq('organization_id',organization_id)
          .eq('contract_number',number).is('deleted_at',null).neq('id',contractId).maybeSingle();
        if (duplicate.error) throw duplicate.error;
        if (duplicate.data) return json({error:'Contrato com este número já existe'},409);
        updates.contract_number = number;
      }
      const current = await admin.from('contracts').select('start_date,end_date,total_value,used_value')
        .eq('organization_id',organization_id).eq('id',contractId).is('deleted_at',null).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return json({error:'Contrato não encontrado'},404);
      const startDate = 'start_date' in updates ? updates.start_date : current.data.start_date;
      const endDate = 'end_date' in updates ? updates.end_date : current.data.end_date;
      if (startDate && endDate && endDate < startDate) {
        return json({error:'A vigência final não pode anteceder a inicial'},400);
      }
      if ('total_value' in updates && Number(updates.total_value) < Number(current.data.used_value)) {
        return json({error:'O valor total não pode ser inferior ao valor já utilizado'},400);
      }
      if ('total_value' in updates) updates.total_value = Number(updates.total_value);
      const updated = await admin.rpc('update_integrated_contract',{
        p_organization_id:organization_id,p_user_id:user?.id || null,
        p_contract_id:contractId,p_updates:updates,
      });
      if (updated.error?.code === '23505') return json({error:'Contrato com este número já existe'},409);
      if (updated.error) throw updated.error;
      return json({api_version:'v1',data:updated.data});
    }
    if (operation !== 'list') return json({error:'Operação não suportada'},400);
    if (credential && !credential.scopes.includes('contracts:read')) {
      return json({error:'Credencial sem escopo contracts:read'},403);
    }
    const page = Math.max(1, Math.min(10000, Math.floor(Number(body.page) || 1)));
    const per_page = Math.max(1, Math.min(100, Math.floor(Number(body.per_page) || 25)));
    const offset = (page - 1) * per_page;
    let query = admin.from('contracts')
      .select('id,contract_number,object,status,start_date,end_date,total_value,used_value,updated_at', { count: 'exact' })
      .eq('organization_id', organization_id).is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (body.status) {
      if (!contractStatuses.includes(body.status)) return json({error:'Filtro de status inválido'},400);
      query = query.eq('status',body.status);
    }
    if (body.supplier_id) {
      if (!/^[a-f0-9-]{36}$/i.test(String(body.supplier_id))) return json({error:'Filtro de fornecedor inválido'},400);
      query = query.eq('supplier_id',body.supplier_id);
    }
    for (const key of ['end_date_from','end_date_to']) {
      if (body[key] && !isDate(body[key])) return json({error:`${key} deve estar no formato AAAA-MM-DD`},400);
    }
    if (body.end_date_from) query = query.gte('end_date',body.end_date_from);
    if (body.end_date_to) query = query.lte('end_date',body.end_date_to);
    if (body.contract_number) query = query.ilike('contract_number',`%${String(body.contract_number).slice(0,100)}%`);
    if (body.updated_since) {
      const updatedSince = Date.parse(String(body.updated_since));
      if (!Number.isFinite(updatedSince)) return json({error:'updated_since inválido'},400);
      query = query.gte('updated_at',new Date(updatedSince).toISOString());
    }
    const result = await query.range(offset, offset + per_page - 1);
    if (result.error) throw result.error;
    return json({
      api_version: 'v1',
      organization_id,
      data: result.data || [],
      pagination: { page, per_page, total: result.count ?? 0,
        total_pages: Math.ceil((result.count ?? 0) / per_page) },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
