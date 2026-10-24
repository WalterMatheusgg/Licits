import { json, options, authorize, member, readJson, errorResponse } from '../_shared/security.ts';
Deno.serve(async req => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    const { admin, user } = await authorize(req);
    const body = await readJson(req);
    await member(admin, user.id, String(body.organization_id || ''), ['organization_admin', 'gestor']);
    return json({
      error: 'A extração documental agora é local no navegador. Use Importar Documento na tela de Contratos.',
    }, 410);
  } catch (error) {
    return errorResponse(error);
  }
});
