import {json,options,authorize,member} from '../_shared/security.ts';
Deno.serve(async req => {
  const preflight=options(req);if(preflight)return preflight;
  try{
    const {admin,user}=await authorize(req), body=await req.json();
    const org=String(body.organization_id||''),email=String(body.email||'').trim().toLowerCase(),role=String(body.role||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('E-mail inválido.');
    if(!['organization_admin','gestor','fiscal','operacional','visualizador'].includes(role))throw Error('Papel inválido.');
    await member(admin,user.id,org,['organization_admin']);
    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'invite-member'});
    if(capacity.error)throw capacity.error;
    const existing=await admin.from('profiles').select('id').eq('email',email).maybeSingle();
    if(existing.error)throw existing.error;
    let id=existing.data?.id;
    let emailSent=false;
    if(!id){const invitation=await admin.auth.admin.inviteUserByEmail(email);
      if(invitation.error||!invitation.data.user)throw invitation.error||Error('Não foi possível enviar convite.');
      id=invitation.data.user.id;
      emailSent=true;}
    const existingMembership=await admin.from('organization_members')
      .select('id,status').eq('organization_id',org).eq('user_id',id).maybeSingle();
    if(existingMembership.error)throw existingMembership.error;
    if(existingMembership.data?.status==='active')throw Error('Usuário já pertence à organização.');
    const result=await admin.from('organization_members').upsert({
      organization_id:org,user_id:id,role,status:'invited',
      accepted_at:null,created_by:user.id,updated_by:user.id
    },{onConflict:'organization_id,user_id'}).select('id').single();
    if(result.error)throw result.error;
    return json({success:true,membership_id:result.data.id,pending_acceptance:true,email_sent:emailSent});
  }catch(e){return json({error:String(e instanceof Error?e.message:e)},400);}
});
