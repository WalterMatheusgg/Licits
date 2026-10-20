import {json,options,authorize,member,firstOrg,env} from '../_shared/security.ts';
Deno.serve(async req => {
  const preflight=options(req);if(preflight)return preflight;
  try{
    const {admin,user}=await authorize(req),body=await req.json();
    const to=String(body.to||'').trim().toLowerCase(), subject=String(body.subject||''),content=String(body.body||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||!subject.trim()||!content.trim()||subject.length>200||content.length>20000)throw Error('Mensagem inválida.');
    const org=String(body.organization_id||'');
    await member(admin,user.id,org,['organization_admin','gestor']);
    const profile=await admin.from('profiles').select('id').eq('email',to).maybeSingle();
    if(!profile.data)throw Error('Destinatário desconhecido.');
    await member(admin,profile.data.id,org);
    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'send-email'});
    if(capacity.error)throw capacity.error;
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',
      headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json'},
      body:JSON.stringify({from:env('RESEND_FROM_EMAIL'),to:[to],subject,text:content})});
    const result=await resp.json();
    if(!resp.ok)throw Error(String(result.message||resp.status));
    return json({success:true,id:result.id});
  }catch(e){return json({error:String(e instanceof Error?e.message:e)},400);}
});
