import {json,options,authorize,member,readJson,errorResponse,HttpError} from '../_shared/security.ts';
import {mailDeliveryReady,sendConfiguredEmail} from '../_shared/email-provider.ts';
const roleLabels: Record<string,string> = {
  organization_admin:'Administrador',
  gestor:'Gestor',
  fiscal:'Fiscal',
  operacional:'Operacional',
  visualizador:'Visualizador',
};
Deno.serve(async req => {
  const preflight=options(req);if(preflight)return preflight;
  try{
    const {admin,user}=await authorize(req), body=await readJson(req);
    const org=String(body.organization_id||''),email=String(body.email||'').trim().toLowerCase(),role=String(body.role||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new HttpError('E-mail inválido.',400);
    if(!['organization_admin','gestor','fiscal','operacional','visualizador'].includes(role))throw new HttpError('Papel inválido.',400);
    await member(admin,user.id,org,['organization_admin']);
    const existing=await admin.from('profiles').select('id').eq('email',email).maybeSingle();
    if(existing.error)throw existing.error;
    let id=existing.data?.id;
    let emailSent=false;
    let actionLink: string | undefined;
    if(id){
      const existingMembership=await admin.from('organization_members')
        .select('id,status').eq('organization_id',org).eq('user_id',id).maybeSingle();
      if(existingMembership.error)throw existingMembership.error;
      if(existingMembership.data?.status==='active')throw new HttpError('Usuário já pertence à organização.',409);
      if(!mailDeliveryReady())throw new HttpError('Provedor de e-mail não configurado para reenviar o convite.',503);
    }
    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'invite-member'});
    if(capacity.error)throw capacity.error;
    if(id){
      const link=await admin.auth.admin.generateLink({type:'magiclink',email});
      if(link.error||!link.data.properties?.action_link)throw link.error||Error('Não foi possível gerar o link de acesso.');
      actionLink=link.data.properties.action_link;
    }else{
      const invitation=await admin.auth.admin.inviteUserByEmail(email);
      if(invitation.error||!invitation.data.user)throw invitation.error||Error('Não foi possível enviar convite.');
      id=invitation.data.user.id;
    }
    const result=await admin.from('organization_members').upsert({
      organization_id:org,user_id:id,role,status:'invited',
      accepted_at:null,created_by:user.id,updated_by:user.id
    },{onConflict:'organization_id,user_id'}).select('id').single();
    if(result.error)throw result.error;
    if(actionLink){
      await sendConfiguredEmail({
        to:email,
        subject:'Convite para acessar o Licits',
        text:`Você recebeu um convite para acessar o Licits como ${roleLabels[role]}.\n\nAcesse sua conta por este link e aceite o convite da organização:\n${actionLink}\n\nSe você não solicitou este acesso, ignore esta mensagem.`,
      });
      emailSent=true;
    }else{
      emailSent=true;
    }
    return json({
      success:true,
      membership_id:result.data.id,
      pending_acceptance:true,
      email_sent:emailSent,
      existing_user:Boolean(existing.data),
    });
  }catch(e){return errorResponse(e);}
});
