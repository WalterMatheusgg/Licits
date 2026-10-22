import { json, options, authorize, member } from '../_shared/security.ts';
Deno.serve(async req => {
  const preflight = options(req);
  if (preflight) return preflight;
  try {
    const { admin, user } = await authorize(req);
    const body = await req.json();
    await member(admin, user.id, String(body.organization_id || ''), ['organization_admin', 'gestor']);
    return json({
      error: 'A extração documental agora é local no navegador. Use Importar Documento na tela de Contratos.',
    }, 410);
  } catch (error) {
    return json({error: String(error instanceof Error ? error.message : error)}, 400);
  }
});
