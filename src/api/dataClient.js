import { supabase } from '@/lib/supabaseClient';

/**
 * Supabase data gateway for the existing Licits screens.
 * Every tenant-scoped query includes organization_id and is additionally protected by database RLS.
 * Data is never fabricated if Supabase is unavailable.
 */
const definitions = {
  Contract: { table: 'contracts', columns: 'supplier_id contract_number sei_number auction_number object modality contract_type status responsible_sector start_date end_date total_value used_value can_extend extensions_done max_extensions fiscal_status source_document_id ai_summary ai_risks clauses notes', soft: true, supplier: true },
  ContractItem: { table: 'contract_items', columns: 'contract_id group_number item_number description unit contracted_qty minimum_qty used_qty unit_price', soft: true },
  ItemWithdrawal: { table: 'item_withdrawals', columns: 'contract_id contract_item_id service_order_number withdrawal_date quantity notes user_id' },
  Document: { table: 'documents', columns: 'contract_id title document_type storage_bucket storage_path original_filename mime_type file_size checksum status version signed_by signed_at notes', soft: true },
  FiscalRecord: { table: 'fiscal_records', columns: 'contract_id record_type title description document_id comments status fiscal_date signed_by signed_at attachment_bucket attachment_path attachment_name', soft: true },
  Occurrence: { table: 'occurrences', columns: 'contract_id title content occurrence_date severity status registered_by resolved_by resolved_at resolution document_id attachment_bucket attachment_path attachment_name', soft: true },
  PriceRegistration: { table: 'price_registrations', columns: 'auction_number sei_number object registration_type adhesion_organization adhesion_auction_number status notes', soft: true },
  PriceRegistrationGroup: { table: 'price_registration_groups', columns: 'price_registration_id supplier_id arp_number group_number start_date end_date total_value can_extend status notes', soft: true, supplier: true },
  AdminRequest: { table: 'admin_requests', columns: 'requester_id entity_type entity_id entity_label request_type description status admin_response resolved_by resolved_at' },
  Notification: { table: 'notifications', columns: 'target_user_id title message type priority entity_type entity_id read_at' },
  AuditLog: { table: 'audit_logs', columns: 'user_id action entity_type entity_id old_data new_data metadata ip_address user_agent' }
};
const writable = (name) => new Set((definitions[name]?.columns || '').split(' ').filter(Boolean));
const exposedColumns = (name) => writable(name);
const uploads = new Map();
const secureId = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2);
const fail = (message) => { throw new Error(message); };
const unwrap = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
const safeText = (v) => v === '' || v === undefined ? null : v;
const sanitizeCnpj = (s) => String(s || '').replace(/\D/g, '');
const roleForUI = (role) => role === 'organization_admin' ? 'admin' : role === 'gestor' || role === 'fiscal' ? 'gestor' : 'operacional';
const roleForDB = (role) => role === 'admin' ? 'organization_admin' : role === 'gestor' ? 'gestor' : role === 'operacional' ? 'operacional' : role;
const statusForUI = (s) => s === 'active' ? 'ativo' : s === 'suspended' ? 'bloqueado' : 'inativo';
const statusForDB = (s) => s === 'ativo' ? 'active' : s === 'bloqueado' ? 'suspended' : s === 'inativo' ? 'revoked' : s;

async function context() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return fail('Faça login para consultar os dados.');
  const saved = window.localStorage.getItem('licits.activeOrganizationId.' + user.id);
  const membershipRows = unwrap(await supabase.from('organization_members')
    .select('organization_id, role, status').eq('user_id', user.id).eq('status', 'active'));
  const membership = membershipRows.find(m => m.organization_id === saved) || membershipRows[0];
  if (!membership) return fail('Usuário sem organização ativa. Solicite acesso a um administrador.');
  return { user, org: membership.organization_id, role: membership.role };
}
async function currentUser() {
  const ctx = await context();
  const profile = unwrap(await supabase.from('profiles').select('full_name,email,status').eq('id', ctx.user.id).maybeSingle());
  return {
    id: ctx.user.id, email: profile?.email || ctx.user.email,
    full_name: profile?.full_name || ctx.user.user_metadata?.full_name || ctx.user.email,
    role: roleForUI(ctx.role), status: statusForUI(profile?.status || 'active')
  };
}
async function supplierIdFor(data, ctx) {
  if (data.supplier_id) return data.supplier_id;
  const name = (data.supplier_name || '').trim();
  if (!name) fail('Informe o fornecedor do contrato ou da ata.');
  const cnpj = sanitizeCnpj(data.supplier_cnpj);
  let query = supabase.from('suppliers').select('id').eq('organization_id', ctx.org).is('deleted_at', null);
  query = cnpj ? query.eq('cnpj', cnpj) : query.eq('legal_name', name);
  const existing = unwrap(await query.limit(1));
  if (existing.length) return existing[0].id;
  const row = {
    organization_id: ctx.org, created_by: ctx.user.id, legal_name: name,
    cnpj: cnpj || null, email: safeText(data.supplier_email),
    address: safeText(data.supplier_address), city: safeText(data.supplier_city),
    state: safeText(data.supplier_state), phone: safeText(data.supplier_phone),
    postal_code: safeText(data.supplier_cep), contact_name: safeText(data.supplier_contact)
  };
  return unwrap(await supabase.from('suppliers').insert(row).select('id').single()).id;
}
function selectFor(name) {
  return definitions[name].supplier ? '*, supplier:suppliers(*)' : '*';
}
function display(name, row) {
  if (!row) return row;
  const r = { ...row, created_date: row.created_at, updated_date: row.updated_at };
  if (row.supplier) {
    Object.assign(r, {
      supplier_name: row.supplier.legal_name,
      supplier_cnpj: row.supplier.cnpj,
      supplier_address: row.supplier.address,
      supplier_city: row.supplier.city,
      supplier_state: row.supplier.state,
      supplier_cep: row.supplier.postal_code,
      supplier_phone: row.supplier.phone,
      supplier_email: row.supplier.email,
      supplier_contact: row.supplier.contact_name
    });
  }
  if (name === 'ContractItem') r.min_qty = r.minimum_qty;
  if (name === 'ItemWithdrawal') {
    r.item_id = r.contract_item_id;
    r.os_number = r.service_order_number;
  }
  if (name === 'Occurrence') r.description = r.content;
  if (name === 'Occurrence' || name === 'FiscalRecord') {
    r.file_name = r.attachment_name;
    r.file_url = null;
  }
  if (name === 'Notification') r.read = !!r.read_at;
  if (name === 'Document') {
    r.file_name = r.original_filename;
    r.file_url = null; // a URL de arquivos privados deve ser assinada no momento do acesso
  }
  return r;
}
async function presentWithPrivateFiles(name, rows) {
  return Promise.all(rows.map(async (row) => {
    const out = display(name, row);
    const bucket = name === 'Document' ? row.storage_bucket : row.attachment_bucket;
    const path = name === 'Document' ? row.storage_path : row.attachment_path;
    if (bucket && path) {
      const res = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (!res.error) out.file_url = res.data.signedUrl;
    }
    return out;
  }));
}
async function scopedQuery(name, filter = {}, order = '-created_date', limit) {
  if (name === 'User') return listUsers();
  if (!definitions[name]) return fail('Entidade desconhecida: ' + name);
  const ctx = await context();
  let query = supabase.from(definitions[name].table).select(selectFor(name)).eq('organization_id', ctx.org);
  if (definitions[name].soft) query = query.is('deleted_at', null);
  if (name === 'Notification') query = query.or('target_user_id.is.null,target_user_id.eq.' + ctx.user.id);
  for (const [field, value] of Object.entries(filter || {})) {
    if (field === 'read' && name === 'Notification') {
      query = value ? query.not('read_at', 'is', null) : query.is('read_at', null);
      continue;
    }
    const key = {item_id:'contract_item_id', os_number:'service_order_number', min_qty:'minimum_qty'}[field] || field;
    if (!exposedColumns(name).has(key) && key !== 'id') return fail('Filtro não suportado: ' + field);
    query = value === null ? query.is(key, null) : query.eq(key, value);
  }
  const sortField = String(order || '-created_date').replace(/^-/, '').replace(/^created_date$/, 'created_at').replace(/^updated_date$/, 'updated_at');
  const allowedSort = exposedColumns(name).has(sortField) || ['created_at','updated_at','id'].includes(sortField) ? sortField : 'created_at';
  query = query.order(allowedSort, { ascending: !String(order || '').startsWith('-') });
  if (Number.isInteger(limit) && limit > 0) query = query.limit(Math.min(limit, 1000));
  return presentWithPrivateFiles(name, unwrap(await query));
}
async function prepare(name, input, ctx, action) {
  const data = {...input};
  const row = {};
  if (name === 'Contract' || name === 'PriceRegistrationGroup') {
    if (action === 'create' || data.supplier_name || data.supplier_id) row.supplier_id = await supplierIdFor(data, ctx);
  }
  if (name === 'ItemWithdrawal') {
    return {
      p_organization_id: ctx.org,
      p_contract_item_id: data.item_id || data.contract_item_id,
      p_quantity: Number(data.quantity),
      p_service_order_number: data.os_number || data.service_order_number || null,
      p_withdrawal_date: data.withdrawal_date || new Date().toISOString().slice(0,10),
      p_notes: data.notes || null
    };
  }
  if (name === 'Occurrence') {
    data.content = data.content || data.description;
    if (action === 'create') data.registered_by = ctx.user.id;
    if (data.status === 'resolvida') {
      data.resolved_by = ctx.user.id;
      data.resolved_at = new Date().toISOString();
    }
  }
  if (name === 'Occurrence' || name === 'FiscalRecord') {
    const stored = uploads.get(data.file_url);
    if (stored) {
      const expectedBucket = name === 'Occurrence' ? 'occurrences' : 'fiscal-records';
      if (stored.bucket !== expectedBucket) fail('O arquivo foi enviado para um destino diferente.');
      data.attachment_bucket = stored.bucket;
      data.attachment_path = stored.path;
      data.attachment_name = stored.name;
    }
  }
  if (name === 'FiscalRecord' && data.signed_by && !String(data.signed_by).match(/^[0-9a-f-]{36}$/i)) data.signed_by = ctx.user.id;
  if (name === 'AdminRequest') {
    if (action === 'create') data.requester_id = ctx.user.id;
    if (data.resolved_by && !String(data.resolved_by).match(/^[0-9a-f-]{36}$/i)) data.resolved_by = ctx.user.id;
  }
  if (name === 'Notification') {
    if ('read' in data) data.read_at = data.read ? new Date().toISOString() : null;
  }
  if (name === 'ContractItem') {
    if (data.min_qty !== undefined) data.minimum_qty = data.min_qty;
    if (action === 'create') data.used_qty = 0;
    if (action !== 'create') delete data.used_qty; // somente a RPC atualiza consumo
  }
  if (name === 'Document') {
    const stored = uploads.get(data.file_url);
    if (stored) {
      data.storage_bucket = stored.bucket;
      data.storage_path = stored.path;
      data.original_filename = data.file_name || stored.name;
      data.file_size = stored.size;
      data.mime_type = stored.type;
    }
    if (!data.storage_path || !data.storage_bucket) fail('Faça o upload do documento antes de salvar.');
    data.document_type = data.document_type || 'outro';
  }
  if (name === 'PriceRegistration' && !data.registration_type) data.registration_type = 'srp_cfp';
  for (const key of exposedColumns(name)) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) row[key] = safeText(data[key]);
  }
  if (action === 'create') {
    row.organization_id = ctx.org;
    if (!['Notification'].includes(name)) row.created_by = ctx.user.id;
    if (name === 'AdminRequest') delete row.created_by;
  }
  return row;
}
async function create(name, data) {
  if (name === 'AuditLog') return fail('A auditoria é registrada automaticamente pelo banco.');
  if (name === 'User') return fail('Convide novos membros pelo serviço seguro de administração.');
  const ctx = await context();
  if (name === 'ItemWithdrawal') {
    const args = await prepare(name, data, ctx, 'create');
    const out = unwrap(await supabase.rpc('register_item_withdrawal', args));
    return display(name, out.withdrawal);
  }
  if (!definitions[name]) return fail('Entidade não suportada: ' + name);
  const row = await prepare(name, data, ctx, 'create');
  const result = unwrap(await supabase.from(definitions[name].table).insert(row).select(selectFor(name)).single());
  return (await presentWithPrivateFiles(name, [result]))[0];
}
async function update(name, id, data) {
  const ctx = await context();
  if (name === 'User') return updateMember(id, data, ctx);
  if (!definitions[name] || name === 'AuditLog' || name === 'ItemWithdrawal') return fail('Atualização não autorizada para ' + name);
  const row = await prepare(name, data, ctx, 'update');
  if (name === 'Notification') {
    for (const k of Object.keys(row)) if (k !== 'read_at') delete row[k];
  }
  if (!Object.keys(row).length) return fail('Nenhum campo válido para atualizar.');
  const res = unwrap(await supabase.from(definitions[name].table).update(row)
    .eq('organization_id', ctx.org).eq('id', id).select(selectFor(name)).single());
  return (await presentWithPrivateFiles(name, [res]))[0];
}
async function remove(name, id) {
  const ctx = await context();
  if (name === 'User') return updateMember(id, { status: 'inativo' }, ctx);
  if (!definitions[name]?.soft) return fail('Esta entidade não permite exclusão direta: ' + name);
  const result = unwrap(await supabase.from(definitions[name].table).update({
    deleted_at: new Date().toISOString(), deleted_by: ctx.user.id
  }).eq('organization_id', ctx.org).eq('id', id).select('id').single());
  return result;
}
async function listUsers() {
  const ctx = await context();
  const members = unwrap(await supabase.from('organization_members')
    .select('user_id,role,status').eq('organization_id', ctx.org));
  if (!members.length) return [];
  const profiles = unwrap(await supabase.from('profiles').select('id,full_name,email,status').in('id', members.map(m => m.user_id)));
  const byId = Object.fromEntries(profiles.map(p => [p.id,p]));
  return members.map(m => {
    const profile = byId[m.user_id] || {};
    return {
      id: m.user_id, full_name: profile.full_name, email: profile.email,
      role: roleForUI(m.role), status: statusForUI(m.status),
      organization_id: ctx.org
    };
  });
}
async function updateMember(id, data, ctx) {
  const changes = {};
  if (data.role) changes.role = roleForDB(data.role);
  if (data.status) changes.status = statusForDB(data.status);
  if (changes.status === 'active') changes.accepted_at = new Date().toISOString();
  if (!Object.keys(changes).length) return fail('Atualização de membro inválida.');
  const updated = unwrap(await supabase.from('organization_members').update(changes)
    .eq('organization_id', ctx.org).eq('user_id', id).select('user_id,role,status').single());
  return { id: updated.user_id, role: roleForUI(updated.role), status: statusForUI(updated.status) };
}
async function uploadFile({ file, bucket = 'contracts' }) {
  if (!(file instanceof Blob)) return fail('Selecione um arquivo válido.');
  if (file.size > 20 * 1024 * 1024) return fail('O arquivo deve ter no máximo 20 MB.');
  const ctx = await context();
  const allowed = ['contracts', 'fiscal-records', 'occurrences','generated-documents'];
  if (!allowed.includes(bucket)) return fail('Destino de armazenamento não permitido.');
  const fileName = (file.name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90);
  const path = ctx.org + '/' + secureId() + '-' + fileName;
  unwrap(await supabase.storage.from(bucket).upload(path, file, {
    upsert: false, contentType: file.type || 'application/octet-stream'
  }));
  const url = unwrap(await supabase.storage.from(bucket).createSignedUrl(path, 3600)).signedUrl;
  uploads.set(url, { bucket, path, name: file.name || fileName, type: file.type, size: file.size });
  return { file_url: url, storage_bucket: bucket, storage_path: path };
}
async function invokeFunction(name, payload) {
  const result = await supabase.functions.invoke(name, { body: payload });
  if (result.error) return fail('Integração ' + name + ': ' + result.error.message + '. Verifique a implantação e as credenciais seguras.');
  return result.data;
}
const entities = new Proxy({}, { get(_, name) {
  if (typeof name !== 'string') return undefined;
  return {
    list: (order, limit) => scopedQuery(name, {}, order, limit),
    filter: (filter, order, limit) => scopedQuery(name, filter, order, limit),
    create: (data) => create(name, data),
    update: (id, data) => update(name, id, data),
    delete: (id) => remove(name, id)
  };
}});
export const dataClient = {
  auth: { me: currentUser },
  entities,
  users: {
    inviteUser: async (email, role) => {
      const ctx = await context();
      return invokeFunction('invite-member', { email, role: roleForDB(role), organization_id: ctx.org });
    }
  },
  integrations: { Core: {
    UploadFile: uploadFile,
    SendEmail: ({ to, subject, body }) => invokeFunction('send-email', { to, subject, body }),
    InvokeLLM: async ({ prompt, response_json_schema }) => (await invokeFunction('analyze-contract', { prompt, response_json_schema })).result,
    ExtractDataFromUploadedFile: () => fail('Extração automática de documento ainda requer função específica de processamento.')
  }}
};
