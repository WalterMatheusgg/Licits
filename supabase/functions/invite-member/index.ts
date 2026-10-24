import {json,options,authorize,member,readJson,errorResponse,HttpError} from '../_shared/security.ts';
import {mailDeliveryReady,sendConfiguredEmail} from '../_shared/email-provider.ts';

// Invite links are generated in our own backend and verified directly by the
// Supabase client. They do not depend on an Auth Site URL or allow-listed redirect.
// PUBLIC_APP_URL is trusted server configuration, never read from request headers.
const DEFAULT_APP_URL='https://licits.vercel.app';
function appBaseUrl(): URL {
  const configured=(Deno.env.get('PUBLIC_APP_URL') || DEFAULT_APP_URL).trim();
  try {
    const url=new URL(configured);
    if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') {
      throw new Error('Invalid origin');
    }
    return url;
  } catch {
    throw new HttpError('PUBLIC_APP_URL inválida. Configure uma origem HTTPS pública.',500);
  }
}
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

    // Validate delivery and origin before creating an Auth user or membership.
    if(!mailDeliveryReady())throw new HttpError('Provedor de e-mail não configurado para enviar convites.',503);
    const appUrl=appBaseUrl();

    const existing=await admin.from('profiles').select('id').eq('email',email).maybeSingle();
    if(existing.error)throw existing.error;
    const existingId=existing.data?.id;
    if(existingId){
      const membership=await admin.from('organization_members')
        .select('id,status').eq('organization_id',org).eq('user_id',existingId).maybeSingle();
      if(membership.error)throw membership.error;
      if(membership.data?.status==='active')throw new HttpError('Usuário já pertence à organização.',409);
    }

    const capacity=await admin.rpc('reserve_integration_capacity',{p_organization_id:org,p_user_id:user.id,p_operation:'invite-member'});
    if(capacity.error)throw capacity.error;

    // generateLink creates invited auth.users for new emails; existing users
    // receive a one-time magic link. No automatic Supabase SMTP or redirect.
    const type=existingId ? 'magiclink' : 'invite';
    const generated=await admin.auth.admin.generateLink({type,email});
    if(generated.error || !generated.data?.user?.id || !generated.data.properties?.hashed_token) {
      throw generated.error || new Error('Não foi possível gerar o link de confirmação.');
    }
    const id=generated.data.user.id;
    if(existingId && id!==existingId)throw new HttpError('Identidade de convite inconsistente.',409);

    const result=await admin.from('organization_members').upsert({
      organization_id:org,user_id:id,role,status:'invited',
      accepted_at:null,created_by:user.id,updated_by:user.id
    },{onConflict:'organization_id,user_id'}).select('id').single();
    if(result.error)throw result.error;

    // Sending the token hash to our HTTPS callback means GoTrue SITE_URL and
    // URI_ALLOW_LIST are not involved. The callback calls verifyOtp, and only
    // the signed-in, email-confirmed invited user can accept their org access.
    const confirm=new URL('/auth/confirm',appUrl);
    confirm.searchParams.set('token_hash',generated.data.properties.hashed_token);
    confirm.searchParams.set('type',type);
    await sendConfiguredEmail({
      to:email,
      subject:'Convite para acessar o Licits',
      text:`Você recebeu um convite para acessar o Licits como ${roleLabels[role]}.\n\nConfirme seu e-mail e entre no Licits pelo endereço a seguir:\n${confirm.toString()}\n\nDepois de entrar, aceite o convite da organização. Se você não solicitou este acesso, ignore a mensagem.`,
    });

    return json({
      success:true,
      membership_id:result.data.id,
      pending_acceptance:true,
      email_sent:true,
      existing_user:Boolean(existingId),
    });
  }catch(e){return errorResponse(e);}
});
