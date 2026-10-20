import { createClient } from 'npm:@supabase/supabase-js@2';
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {...cors,'Content-Type':'application/json'}});
export const options = (req: Request) => req.method === 'OPTIONS' ? new Response('ok',{headers:cors}) : null;
export const env = (key:string) => { const v=Deno.env.get(key); if(!v)throw Error('Configuração ausente: '+key);return v; };
export async function authorize(req: Request) {
  if (req.method !== 'POST') throw Error('Apenas POST');
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!token) throw Error('Faça login.');
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
  const {data:auth,error}=await admin.auth.getUser(token);
  if(error || !auth.user) throw Error('Sessão inválida.');
  const profile=await admin.from('profiles').select('status').eq('id',auth.user.id).maybeSingle();
  if(profile.error || profile.data?.status !== 'active')throw Error('Perfil bloqueado.');
  return {admin,user:auth.user};
}
export async function member(admin:any,uid:string,org:string,roles?:string[]){
  const {data,error}=await admin.from('organization_members').select('role,status').eq('user_id',uid).eq('organization_id',org).eq('status','active').maybeSingle();
  const orgResult=await admin.from('organizations').select('status,deleted_at').eq('id',org).maybeSingle();
  if(error || !data || orgResult.error || orgResult.data?.status !== 'active' || orgResult.data?.deleted_at)throw Error('Organização inacessível.');
  if(roles && !roles.includes(data.role))throw Error('Sem permissão.');
  return data;
}
export async function firstOrg(admin:any,uid:string){
  const {data,error}=await admin.from('organization_members').select('organization_id').eq('user_id',uid).eq('status','active').limit(1);
  if(error||!data?.length)throw Error('Usuário sem organização ativa.');
  return data[0].organization_id as string;
}
