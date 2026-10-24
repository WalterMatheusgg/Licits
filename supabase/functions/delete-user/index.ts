import {json,options,authorize,member,readJson,errorResponse,HttpError} from '../_shared/security.ts';

Deno.serve(async req => {
  const preflight=options(req);
  if(preflight)return preflight;

  try{
    const {admin,user}=await authorize(req);
    const body=await readJson(req);
    const organizationId=String(body.organization_id||'');
    const targetId=String(body.user_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(organizationId))throw new HttpError('Organização inválida.',400);
    if(!/^[0-9a-f-]{36}$/i.test(targetId))throw new HttpError('Usuário inválido.',400);
    if(targetId===user.id)throw new HttpError('An administrator cannot delete their own account.',400);

    await member(admin,user.id,organizationId,['organization_admin']);
    const membership=await admin.from('organization_members')
      .select('id').eq('organization_id',organizationId).eq('user_id',targetId).maybeSingle();
    if(membership.error)throw membership.error;
    if(!membership.data)throw new HttpError('Usuário não encontrado nesta organização.',404);

    const platformAdmin=await admin.from('platform_admins')
      .select('user_id').eq('user_id',targetId).maybeSingle();
    if(platformAdmin.error)throw platformAdmin.error;
    if(platformAdmin.data)throw new HttpError('Administradores da plataforma não podem ser excluídos por esta tela.',409);

    const adminMemberships=await admin.from('organization_members')
      .select('organization_id')
      .eq('user_id',targetId)
      .eq('role','organization_admin')
      .eq('status','active');
    if(adminMemberships.error)throw adminMemberships.error;
    for(const adminMembership of adminMemberships.data||[]){
      const otherAdmins=await admin.from('organization_members')
        .select('user_id',{count:'exact',head:true})
        .eq('organization_id',adminMembership.organization_id)
        .eq('role','organization_admin')
        .eq('status','active')
        .neq('user_id',targetId);
      if(otherAdmins.error)throw otherAdmins.error;
      if(otherAdmins.count===0){
        throw new HttpError('O usuário é o último administrador ativo de uma organização e não pode ser excluído.',409);
      }
    }

    const deletion=await admin.auth.admin.deleteUser(targetId);
    if(deletion.error)throw deletion.error;
    return json({success:true,deleted_user_id:targetId,history_preserved:true});
  }catch(error){
    return errorResponse(error);
  }
});
