import { createClient } from 'npm:@supabase/supabase-js@2';
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {...cors,'Content-Type':'application/json'}});
export const options = (req: Request) => req.method === 'OPTIONS' ? new Response('ok',{headers:cors}) : null;
export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
export const env = (key:string) => {
  const value=Deno.env.get(key);
  if(!value)throw new HttpError('Serviço temporariamente indisponível.',503);
  return value;
};
export async function readJson(req: Request, maxBytes = 1024 * 1024): Promise<Record<string, any>> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError('Corpo da solicitação excede o limite permitido.',413);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new HttpError('Corpo da solicitação excede o limite permitido.',413);
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk,offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError('O corpo JSON deve ser um objeto.',400);
    }
    return value as Record<string, any>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Corpo JSON inválido.',400);
  }
}
export function errorResponse(error: unknown, requestId: string = crypto.randomUUID()): Response {
  if (error instanceof HttpError) return json({error:error.message},error.status);
  console.error(JSON.stringify({
    event:'edge_request_failed',
    request_id:requestId,
    error_type:error instanceof Error ? error.name : 'unknown',
  }));
  return json({error:'Não foi possível processar a solicitação.',request_id:requestId},500);
}
export async function authorize(req: Request) {
  if (req.method !== 'POST') throw new HttpError('Apenas POST.',405);
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!token) throw new HttpError('Faça login.',401);
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
  const {data:auth,error}=await admin.auth.getUser(token);
  if(error || !auth.user) throw new HttpError('Sessão inválida.',401);
  const profile=await admin.from('profiles').select('status').eq('id',auth.user.id).maybeSingle();
  if(profile.error)throw profile.error;
  if(profile.data?.status !== 'active')throw new HttpError('Perfil bloqueado.',403);
  return {admin,user:auth.user};
}
export async function member(admin:any,uid:string,org:string,roles?:string[]){
  const {data,error}=await admin.from('organization_members').select('role,status').eq('user_id',uid).eq('organization_id',org).eq('status','active').maybeSingle();
  const orgResult=await admin.from('organizations').select('status,deleted_at').eq('id',org).maybeSingle();
  if(error)throw error;
  if(orgResult.error)throw orgResult.error;
  if(!data || orgResult.data?.status !== 'active' || orgResult.data?.deleted_at)throw new HttpError('Organização inacessível.',403);
  if(roles && !roles.includes(data.role))throw new HttpError('Sem permissão.',403);
  return data;
}
export async function firstOrg(admin:any,uid:string){
  const {data,error}=await admin.from('organization_members').select('organization_id').eq('user_id',uid).eq('status','active').limit(1);
  if(error||!data?.length)throw Error('Usuário sem organização ativa.');
  return data[0].organization_id as string;
}
