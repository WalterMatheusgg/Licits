#!/usr/bin/env node
/**
 * Read-only deployment smoke test.
 * No user credentials or database writes. Never logs API keys.
 * The result proves endpoint reachability and anonymous RLS only; it does not
 * prove authenticated flows or deployed Edge Functions.
 */
const { LICITS_SMOKE_SUPABASE_URL: rawUrl, LICITS_SMOKE_PUBLISHABLE_KEY: key } = process.env;
function fail(msg) { console.error('LICITS SMOKE FAILED:',msg); process.exitCode=1; }
if (!rawUrl || !key) {
  fail('Configure LICITS_SMOKE_SUPABASE_URL and LICITS_SMOKE_PUBLISHABLE_KEY as GitHub Actions secrets.');
  process.exit();
}
let origin;
try {
  const u = new URL(rawUrl);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co') ||
      u.pathname !== '/' || u.username || u.password || u.search || u.hash)
    throw Error('URL must be an HTTPS Supabase project origin');
  origin=u.origin;
} catch {
  fail('Supabase URL must be https://<project-ref>.supabase.co, with no credentials.');
  process.exit();
}
async function request(name,path,options={}) {
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),12000);
  try {
    const res=await fetch(new URL(path,origin),{
      ...options,signal:ctrl.signal,redirect:'error',
      headers:{'apikey':key,...(options.headers||{})}
    });
    console.log(name+': HTTP '+res.status);
    return res;
  } catch(e) {
    fail(name+': connection failed ('+(e?.name==='AbortError'?'timeout':'network error')+').');
    return null;
  } finally {clearTimeout(timeout);}
}
const auth=await request('Authentication service','/auth/v1/health');
if (!auth || !auth.ok) fail('Supabase Auth is not available with the supplied project configuration.');
// Non-authenticated PostgREST requests must not disclose tenant data, even with
// the correct public key; query a tiny projection to avoid transferring user data.
for(const table of ['contracts','organization_members','integration_credentials']){
  const res=await request('Anonymous RLS: '+table,
    '/rest/v1/'+table+'?select=id&limit=1',{
      headers:{Authorization:'Bearer '+key,Accept:'application/json'}
    });
  if(!res){continue;}
  if(res.status===401||res.status===403)continue; // closed to anonymous users
  if(!res.ok){fail('Cannot validate '+table+' anonymously; table/schema or permissions may be misconfigured.');continue;}
  const body=await res.json().catch(()=>null);
  if(!Array.isArray(body)){fail('Unexpected '+table+' response.');continue;}
  if(body.length>0)fail('Anonymous requests can read '+table+'! Review grants and Row Level Security.');
}
if(!process.exitCode)console.log('Read-only reachability and anonymous data isolation passed. Authentication flows, mail, storage and backup restore still require separate acceptance tests.');
