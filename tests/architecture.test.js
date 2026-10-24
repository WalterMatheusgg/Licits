import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root=new URL('../',import.meta.url).pathname;
const read=(name)=>readFileSync(join(root,name),'utf8');
function walk(dir) {
  return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(entry=>{
    const pathname=join(dir,entry.name);
    if(entry.isDirectory())return walk(pathname);
    if(!entry.isFile()||!/\.(?:js|jsx|ts|tsx)$/.test(entry.name))return [];
    return [pathname];
  });
}

test('Frontend no longer executes Base44 SDK code',()=>{
  const files=walk('src');
  for(const file of files){
    const code=read(file);
    assert.doesNotMatch(code,/@base44\/sdk|base44Client|base44\.entities|base44\.integrations/i,
      'Legacy runtime dependency in '+file);
  }
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies?.['@base44/sdk'],undefined);
  assert.equal(pkg.devDependencies?.['@base44/vite-plugin'],undefined);
});

test('UI project name is Licits and not an abandoned brand',()=>{
  for(const file of ['index.html','src/pages/auth/Login.jsx',
    'src/components/layout/Sidebar.jsx','src/pages/Dashboard.jsx']){
    assert.doesNotMatch(read(file),/nexofiscal|contratoia/i,file);
  }
  assert.match(read('index.html'),/<title>Licits\b/);
});

test('Mandatory tenant-scoped database operations remain implemented',()=>{
  const client=read('src/api/dataClient.js');
  assert.match(client,/eq\('organization_id',\s*ctx\.org\)/);
  assert.match(client,/register_item_withdrawal/);
  assert.match(client,/archive_business_record/);
  assert.match(client,/preview_contract_purchase/);
  assert.match(client,/supabase\.storage/);
});

test('Deleted users are removed from the organization user list',()=>{
  const client=read('src/api/dataClient.js');
  assert.match(client,/if \(name === 'User'\) return invokeFunction\('delete-user'/);
  assert.match(client,/\.neq\('status', 'revoked'\)/);
  assert.match(client,/\.neq\('status', 'suspended'\)/);
});

test('Blocked users are listed separately and can be unblocked',()=>{
  const client=read('src/api/dataClient.js');
  const page=read('src/pages/Users.jsx');
  assert.match(client,/listBlocked: \(\) => listUsers\('suspended'\)/);
  assert.match(page,/Usuários bloqueados/);
  assert.match(page,/Desbloquear/);
  assert.doesNotMatch(page,/Acesso revogado/);
});

test('User removal keeps the Auth identity and historical data in other organizations',()=>{
  const deletion=read('supabase/functions/delete-user/index.ts');
  const migration=read('supabase/migrations/20261024053500_safe_org_membership_removal.sql');
  const page=read('src/pages/Users.jsx');
  assert.match(deletion,/\.from\('organization_members'\)/);
  assert.match(deletion,/\.delete\(\)\.eq\('organization_id',organizationId\)/);
  assert.doesNotMatch(deletion,/auth\.admin\.deleteUser\(/);
  assert.match(deletion,/targetId===user\.id/);
  assert.match(migration,/protect_last_active_admin_delete/);
  assert.match(migration,/profiles_select_organization_invitees_for_admin/);
  assert.match(page,/Excluir acesso/);
  assert.match(page,/Usuários bloqueados/);
});

test('Organization invitations use trusted configured frontend redirects',()=>{
  const invite=read('supabase/functions/invite-member/index.ts');
  assert.match(invite,/Deno\.env\.get\('PUBLIC_APP_URL'\)/);
  assert.match(invite,/inviteUserByEmail\(email,redirectTo\?/);
  assert.match(invite,/generateLink\(\{type:'magiclink',email,\.\.\.\(redirectTo/);
  assert.doesNotMatch(invite,/req\.headers\.get\(['"](?:origin|host)['"]\)/i);
});

test('Accounting, isolation and delivery logic are tested in PostgreSQL CI',()=>{
  const workflow=read('.github/workflows/supabase-db-ci.yml');
  for(const file of ['tenant_isolation_integration.sql',
    'budget_alerts_integration.sql','invitations_quotas_integration.sql',
    'integration_contract_create.sql','atomic_document_import_integration.sql',
    'organization_membership_removal_integration.sql']){
    assert.ok(existsSync(join(root,'supabase/tests',file)));
    assert.ok(workflow.includes(file),'CI omitted '+file);
  }
  const migrations=readdirSync(join(root,'supabase/migrations'));
  assert.ok(migrations.some(f=>f.includes('deduplicate_safe_audit')));
});

test('API secrets are not passed through the frontend public environment',()=>{
  const client=read('src/lib/supabaseClient.js');
  assert.match(client,/VITE_SUPABASE_PUBLISHABLE_KEY/);
  for(const file of walk('src')){
    assert.doesNotMatch(read(file),/import\.meta\.env\.VITE_(?:SERVICE_ROLE|OPENAI_API_KEY|RESEND_API_KEY)/,
      'Sensitive Vite environment variable in '+file);
  }
});

test('SPA routes use lazy loading and browser deep links have a fallback',()=>{
  assert.match(read('src/App.jsx'),/lazy\(\(\)\s*=>\s*import\(/);
  assert.match(read('src/App.jsx'),/<Suspense/);
  const cfg=JSON.parse(read('vercel.json'));
  assert.equal(cfg.rewrites?.[0]?.destination,'/index.html');
  assert.match(read('public/_redirects'),/\/\* \/index\.html 200/);
});

test('Production is not marked approved without remote tests',()=>{
  const readme=read('README.md');
  assert.match(readme,/Pronto para produção\?\s*Ainda não/);
  assert.ok(existsSync(join(root,'scripts/verify-remote-supabase.mjs')));
  assert.ok(existsSync(join(root,'docs/PRODUCAO-RECUPERACAO.md')));
});

test('Remote smoke checks high-risk tenant tables without writing to Supabase',()=>{
  const script=read('scripts/verify-remote-supabase.mjs');
  for(const table of ['contracts','profiles','organization_members','suppliers',
    'documents','contract_items','item_withdrawals','fiscal_records','occurrences',
    'audit_logs','integration_credentials','contract_budget_alerts','contract_expiry_alerts']){
    assert.ok(script.includes("'"+table+"'"),'Remote isolation smoke omitted '+table);
  }
  assert.match(script,/if\(body\.length>0\)fail/);
  assert.doesNotMatch(script,/method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/);
  assert.match(read('.github/workflows/remote-smoke.yml'),/workflow_dispatch/);
});

test('Integration gateway does not leak internal errors or preserve CNPJ formatting',()=>{
  const gateway=read('supabase/functions/integration-contracts/index.ts');
  assert.ok(gateway.includes("replace(/\\D/g,'')"), 'Masked CNPJ must strip non-digits');
  assert.ok(!gateway.includes("replace(/\\\\D/g,'')"), 'Escaped literal D regex would reject formatted CNPJ');
  assert.match(gateway,/errorResponse\(error\)/);
  assert.ok(existsSync(join(root,'supabase/functions/_shared/webhook-policy.test.ts')));
});
