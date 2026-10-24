# Autenticação e organizações

## Arquitetura

O frontend usa Supabase Auth com sessão persistente. O acesso ao conteúdo exige:

1. usuário autenticado em `auth.users`;
2. perfil em `public.profiles` com status `active`;
3. vínculo ativo em `public.organization_members`;
4. organização com status `active`.

A organização selecionada é armazenada localmente por usuário. A autorização real continua no banco por meio de RLS.

## Rotas públicas

- `/login`
- `/forgot-password`
- `/update-password`

As demais rotas passam por `ProtectedRoute` e `OrganizationGate`.

## Primeiro usuário

Crie o usuário no painel Supabase em **Authentication → Users**. O trigger `handle_new_auth_user` cria o perfil automaticamente.

Depois, em uma sessão SQL administrativa, crie a organização e o vínculo. Substitua os valores de exemplo:

```sql
insert into public.organizations (name, legal_name, cnpj, status)
values ('Minha organização', 'Minha Organização Ltda.', '00000000000000', 'active')
returning id;

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  accepted_at
)
values (
  'ORGANIZATION_UUID',
  'AUTH_USER_UUID',
  'organization_admin',
  'active',
  now()
);
```

Para tornar o primeiro usuário administrador da plataforma, execute somente em sessão administrativa:

```sql
insert into public.platform_admins (user_id, notes)
values ('AUTH_USER_UUID', 'Administrador inicial');
```

## Bloqueio, exclusão de acesso e novo convite

Na tela **Usuários**, os estados têm significados diferentes:

- **Bloquear:** o vínculo da pessoa passa a `suspended`; ela perde acesso, mas permanece visível na seção **Usuários bloqueados**, de onde um administrador poderá desbloqueá-la.
- **Excluir acesso:** remove fisicamente **somente a linha da pessoa em `organization_members` na organização selecionada**, e ela deixa de aparecer tanto na lista de usuários quanto na de bloqueados. Não cria um registro `revoked`.
- **Convidar novamente:** como a identidade do Supabase Auth e o perfil global são preservados, o mesmo endereço pode receber novo convite com vínculo `invited` e aceitar o acesso novamente.

A exclusão nesta tela **não apaga a conta global** `auth.users` nem o `profiles`. Isso é intencional: uma conta pode pertencer a outras organizações; contratos, fiscalizações, ocorrências, baixas, solicitações e auditorias devem conservar o histórico e as referências de autoria. O perfil deixa de aparecer **na organização da qual foi removido**.

O servidor exige administrador ativo, impede remover o próprio acesso nesta tela e rejeita remoção de administradores da plataforma. Um gatilho SQL protege o último administrador ativo, inclusive para exclusões diretas e simultâneas. Não execute remoção global de usuários Auth como substituto da exclusão de acesso da organização.

## Recuperação de senha

Adicione os endereços permitidos em **Authentication → URL Configuration**:

- URL local, por exemplo `http://localhost:5173/update-password`;
- URL de produção, por exemplo `https://seu-dominio.com/update-password`.

## Variáveis do frontend

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Nunca use no frontend `SUPABASE_SECRET_KEY`, senha do banco, Personal Access Token ou `OPENAI_API_KEY`.

## Permissões da interface

- `organization_admin`: membros, contratos, fiscalização, operação e auditoria;
- `gestor`: contratos, fiscalização e operação;
- `fiscal`: fiscalização e operação;
- `operacional`: operação;
- `visualizador`: leitura;
- `platform_admin`: acesso administrativo global.

Esconder um botão não substitui RLS.
