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
    await member(admin, user.id, organization_id);
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
