import {json,options,authorize,member,env,readJson,errorResponse,HttpError} from '../_shared/security.ts';
Deno.serve(async req => {
  const preflight=options(req);if(preflight)return preflight;
  try{
    const {admin,user}=await authorize(req),body=await readJson(req);
    const to=String(body.to||'').trim().toLowerCase(), subject=String(body.subject||''),content=String(body.body||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!subject.trim()||!content.trim()||subject.length>200||content.length>20000)throw new HttpError('Mensagem inválida.',400);
    const org=String(body.organization_id||'');
    await member(admin,user.id,org,['organization_admin','gestor']);
    const profile=await admin.from('profiles').select('id').eq('email',to).maybeSingle();
    if(profile.error)throw profile.error;
    if(!profile.data)throw new HttpError('Destinatário não disponível para esta organização.',404);
    await member(admin,profile.data.id,org);
    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'send-email'});
    if(capacity.error)throw capacity.error;
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json'},
      body:JSON.stringify({from:env('RESEND_FROM_EMAIL'),to:[to],subject,text:content})});
    if(!resp.ok)throw new HttpError('O serviço de e-mail não aceitou a mensagem.',502);
    const result=await resp.json();
    return json({success:true,id:result.id});
  }catch(e){return errorResponse(e);}
});
