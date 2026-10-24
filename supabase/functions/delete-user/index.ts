import {json,options,authorize,member,readJson,errorResponse,HttpError} from '../_shared/security.ts';

// Remove access from ONE organization only. Keep auth.users and profiles so
// immutable history, fiscal actions and memberships in other organizations survive.
Deno.serve(async req => {
  const preflight=options(req);
  if(preflight)return preflight;
  try {
    const {admin,user}=await authorize(req);
    const body=await readJson(req);
    const organizationId=String(body.organization_id||'');
    const targetId=String(body.user_id||'');
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!uuid.test(organizationId))throw new HttpError('Organização inválida.',400);
    if(!uuid.test(targetId))throw new HttpError('Usuário inválido.',400);
    if(targetId===user.id)throw new HttpError('Você não pode remover o próprio acesso nesta tela.',400);

    await member(admin,user.id,organizationId,['organization_admin']);

    // Never delete the global auth account or profile. No work items are removed.
    const platformAdmin=await admin.from('platform_admins')
      .select('user_id').eq('user_id',targetId).maybeSingle();
    if(platformAdmin.error)throw platformAdmin.error;
    if(platformAdmin.data)throw new HttpError('Administradores da plataforma não podem ser removidos por esta tela.',409);

    // Give a clear error before attempting deletion. The database trigger
    // remains the final safeguard, including simultaneous or direct deletions.
    const target=await admin.from('organization_members')
      .select('role,status').eq('organization_id',organizationId)
      .eq('user_id',targetId).maybeSingle();
    if(target.error)throw target.error;
    if(!target.data)throw new HttpError('Acesso não encontrado nesta organização.',404);
    if(target.data.role==='organization_admin' && target.data.status==='active'){
      const others=await admin.from('organization_members')
        .select('user_id',{count:'exact',head:true})
        .eq('organization_id',organizationId)
        .eq('role','organization_admin').eq('status','active')
        .neq('user_id',targetId);
      if(others.error)throw others.error;
      if(!others.count)throw new HttpError('A organização precisa de pelo menos um administrador ativo.',409);
    }

    // The database BEFORE DELETE trigger serializes last-admin checks to protect
    // against two concurrent removals and direct Data API access.
    const deletion=await admin.from('organization_members')
      .delete().eq('organization_id',organizationId).eq('user_id',targetId)
      .select('id').maybeSingle();
    if(deletion.error)throw deletion.error;
    if(!deletion.data)throw new HttpError('Acesso não encontrado nesta organização.',404);
    return json({success:true,removed_membership_id:deletion.data.id,history_preserved:true,reinvite_allowed:true});
  } catch(error) {
    return errorResponse(error);
  }
});
