import {json,options,authorize,member,readJson,errorResponse,HttpError} from '../_shared/security.ts';
import {mailDeliveryReady,sendConfiguredEmail} from '../_shared/email-provider.ts';
Deno.serve(async req => {
  const preflight=options(req);if(preflight)return preflight;
  try{
    const {admin,user}=await authorize(req),body=await readJson(req);
    const to=String(body.to||'').trim().toLowerCase(), subject=String(body.subject||''),content=String(body.body||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!subject.trim()||!content.trim()||subject.length>200||content.length>20000)throw new HttpError('Mensagem inválida.',400);
    const org=String(body.organization_id||'');
    await member(admin,user.id,org,['organization_admin','gestor']);
    // External email recipients are allowed only for authorized managers and after capacity reservation.
    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'send-email'});
    if(capacity.error)throw capacity.error;
    if(!mailDeliveryReady())throw new HttpError('Provedor de e-mail não configurado.',503);
    const id=await sendConfiguredEmail({to,subject,text:content});
    return json({success:true,id});
  }catch(e){return errorResponse(e);}
});
