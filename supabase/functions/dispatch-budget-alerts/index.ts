import { createClient } from 'npm:@supabase/supabase-js@2';

// Cron-only authenticated delivery of durable fiscal budget warnings.
// Deploy with --no-verify-jwt, and use the separate secret X-Alert-Token.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', {status: 405});
  const expected = Deno.env.get('ALERT_DISPATCH_SECRET');
  if (!expected || expected.length < 32 || req.headers.get('x-alert-token') !== expected)
    return new Response('Unauthorized', {status: 401});
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('RESEND_FROM_EMAIL');
  if (!base || !key || !resendKey || !sender)
    return Response.json({error:'Missing server-side secrets'}, {status:503});

  const db = createClient(base,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const claimed = await db.rpc('claim_contract_budget_alerts',{p_limit:20});
  if (claimed.error) return Response.json({error:claimed.error.message},{status:503});
  let sent=0,failed=0;
  for (const alert of claimed.data || []){
    try {
      const result = await db.from('contracts')
        .select('id,organization_id,contract_number,object,fiscal_user_id,total_value,used_value,end_date')
        .eq('id',alert.contract_id).eq('organization_id',alert.organization_id).single();
      if (result.error || !result.data) throw Error('Contract not found');
      const contract=result.data;
      const roles=await db.from('organization_members')
        .select('user_id,role,status').eq('organization_id',alert.organization_id).eq('status','active');
      if (roles.error) throw roles.error;
      const ids=[...new Set((roles.data||[]).filter(
        r => r.user_id===contract.fiscal_user_id || r.role==='organization_admin'
      ).map(r=>r.user_id))];
      if(!ids.length)throw Error('No active fiscal or administrator');
      const people=await db.from('profiles').select('id,email,full_name,status').in('id',ids).eq('status','active');
      if(people.error)throw people.error;
      const recipients=(people.data||[]).filter(p=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||''));
      if(!recipients.length)throw Error('No validated recipient e-mail');
      const brl=(num:number)=>Number(num).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const pct=contract.total_value>0 ? contract.used_value*100/contract.total_value:0;
      const baseURL=Deno.env.get('LICITS_PUBLIC_URL') || '';
      const url=/^https:\/\//.test(baseURL)? '\nAcessar contrato: '+baseURL.replace(/\/$/,'')+'/contracts/'+contract.id:'';
      const subject='[Licits] Contrato '+contract.contract_number+' — '+alert.threshold_percent+'% do teto';
      const message=[
        'ALERTA DE CONTROLE CONTRATUAL — FISCALIZAÇÃO',
        'Contrato: '+contract.contract_number,
        'Objeto: '+contract.object,
        'Marco de atenção: '+alert.threshold_percent+'% atingidos',
        'Utilização atual: '+pct.toFixed(1)+'%',
        'Valor contratado: '+brl(contract.total_value),
        'Total utilizado: '+brl(contract.used_value),
        'Saldo atual: '+brl(contract.total_value-contract.used_value),
        'Ação recomendada: verificar saldo de itens, novas requisições e documentação antes de autorizar despesas.',
        'Aviso automático; não substitui o controle e a decisão administrativa do fiscal.',
        url
      ].join('\n');
      for(const person of recipients){
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',
          headers:{
            'Authorization':'Bearer '+resendKey,
            'Content-Type':'application/json',
            'Idempotency-Key':'licits-'+alert.id+'-'+person.id
          },
          body:JSON.stringify({from:sender,to:[person.email],subject,text:message})
        });
        if(!response.ok)throw Error('Email service HTTP '+response.status);
      }
      const done=await db.from('contract_budget_alerts').update({
        status:'sent',sent_at:new Date().toISOString(),last_error:null
      }).eq('id',alert.id).eq('status','processing');
      if(done.error)throw done.error;
      sent++;
    } catch(e){
      failed++;
      const minutes=Math.min(360,10*(2**Math.max(0,Number(alert.attempts)-1)));
      await db.from('contract_budget_alerts').update({
        status:'failed',
        last_error:String(e instanceof Error?e.message:e).slice(0,200),
        retry_at:new Date(Date.now()+minutes*60000).toISOString()
      }).eq('id',alert.id).eq('status','processing');
    }
  }
  return Response.json({processed:(claimed.data||[]).length,sent,failed});
});
