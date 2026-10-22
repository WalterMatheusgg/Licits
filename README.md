
> **Novo guia:** [Acesso ao Licits, configuração da IA e integrações externas](docs/GUIA-ACESSO-INTEGRACOES.md).
<div align="center">

# 📑 LICITS
### Gestão de contratos, fiscalização e registros de preços

**React 18 · Vite 6 · Supabase Auth · PostgreSQL · Storage · RLS**

[![Frontend](https://github.com/WalterMatheusgg/Licits/actions/workflows/ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/ci.yml)
[![Supabase SQL](https://github.com/WalterMatheusgg/Licits/actions/workflows/supabase-db-ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/supabase-db-ci.yml)
[![Edge Functions](https://github.com/WalterMatheusgg/Licits/actions/workflows/edge-functions-ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/edge-functions-ci.yml)
![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Homologa%C3%A7%C3%A3o%20externa%20pendente-F59E0B)

**Gestão contratual com organizações isoladas, rastreabilidade, fiscalização e documentos privados.**

</div>

---

## Sobre o projeto

O **Licits** é uma aplicação web para acompanhamento de contratos, fornecedores, atas de registro de preços, fiscalização, ocorrências, documentos e permissões de uma organização.

A migração do **código-fonte do frontend** para Supabase foi realizada. A interface deixou de importar o SDK Base44; as operações de dados passaram por um gateway Supabase com filtragem por organização e políticas **Row Level Security** no PostgreSQL.

> [!IMPORTANT]
> **A compilação e as verificações estáticas não substituem testes com um Supabase real.** Para executar todas as funções é necessário configurar o projeto Supabase, aplicar as migrations, criar a primeira organização e fazer o deploy das Edge Functions. E-mail e IA também exigem serviços terceiros, credenciais privadas e validação específica. **Não está homologado para produção.**

## Para o fiscal de contratos

O Licits organiza o trabalho do fiscal em torno dos contratos **atribuídos a ele**, com valores, saldos, fornecedor, vigência, ocorrências, documentos e histórico de compras/utilizações.

- **Minha carteira:** o painel mostra os contratos atribuídos e os principais riscos financeiros.
- **Compra assistida:** antes de cada baixa, o sistema calcula preço, quantidade restante, saldo financeiro e projeção de consumo.
- **Teto protegido no banco:** a operação é transacional, bloqueando despesas superiores à quantidade ou ao valor global contratado.
- **Alertas de orçamento:** o banco registra avisos ao cruzar 80%, 90% e 100% do teto; uma fila controla as tentativas de envio por e-mail ao fiscal atribuído e aos administradores ativos.
- **Teste com números reais de simulação:** [contrato fictício com R$ 100 mil e 50% de uso](docs/CONTRATO-DEMONSTRACAO.md).

**E-mails externos exigem configuração:** Resend, Edge Function `dispatch-budget-alerts` e agendamento GitHub Actions. Confira [manual de alertas](docs/ALERTAS-FISCAL.md). A aplicação não garante e-mail entregue até que essa integração seja implantada e verificada.

## Funcionalidades implementadas no código

| Módulo | Implementação |
|:--|:--|
| 🔐 **Login e conta** | Supabase Auth, recuperação de senha e proteção de rotas |
| 🏢 **Organizações** | Contexto ativo, vínculo de usuários, papéis e políticas RLS |
| 📑 **Contratos e fornecedores** | Cadastro, consulta, edição, filtros, exclusão lógica e fornecedor relacional |
| 📦 **Itens de contrato** | Quantidades, acompanhamento de consumo e baixa atômica em função SQL |
| 🧾 **Registros de preços** | Atas, grupos de fornecedores e acompanhamento de vigência |
| 🛡️ **Fiscalização e ocorrências** | Registros vinculados aos contratos, histórico e anexos privados |
| 📁 **Documentos** | Upload para bucket privado, metadados SQL e links temporários assinados |
| 📊 **Dashboard e relatórios** | Telas, indicadores, filtros e gráficos alimentados pelas consultas Supabase |
| 👥 **Administração** | Membros, papéis, solicitações e trilha automática de auditoria |
| 🔔 **Notificações** | Leitura de avisos por organização; marcação de leitura de avisos individuais |
| ✉️ **E-mails** | Edge Function autenticada usando Resend, após configuração |
| ✨ **IA documental** | Edge Functions autenticadas para perguntas e extração PDF/JPG/PNG, após configuração e revisão humana |

## Arquitetura

~~~mermaid
flowchart TD
    UI["React 18 · Vite · Tailwind CSS"] --> AUTH["Supabase Auth"]
    UI --> GATE["Gateway de dados por organização"]
    GATE --> DB[("PostgreSQL + Row Level Security")]
    GATE --> STORAGE["Storage privado · URLs assinadas"]
    GATE --> RPC["RPC transacional de baixa de itens"]
    UI --> EDGE["Edge Functions com autorização"]
    EDGE --> EMAIL["Resend · opcional"]
    EDGE --> IA["OpenAI · opcional"]
~~~

- **Frontend:** React Router, TanStack Query, React Hook Form, Tailwind, Radix UI, Recharts.
- **Dados e segurança:** Supabase, PostgreSQL, migrations SQL, autorização no banco, controle de acesso por organização e auditoria em triggers.
- **Funções de servidor:** convite de membros, e-mail, análise assistida e extração documental. Credenciais privadas permanecem no ambiente Edge.

## Executar localmente

### 1. Instalação

Requisitos: Node.js 20 ou superior, npm, conta/projeto Supabase para desenvolvimento e Supabase CLI para banco e funções.

~~~bash
git clone https://github.com/WalterMatheusgg/Licits.git
cd Licits
npm ci
cp .env.example .env.local
~~~

Preencha **apenas configurações públicas** no arquivo .env.local:

~~~dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
~~~

> [!CAUTION]
> Nunca adicione a arquivos **VITE_** credenciais administrativas, service role, senha de banco, chaves do Resend ou OpenAI. Variáveis VITE_ são acessíveis ao navegador.

### 2. Banco de dados

Use um projeto Supabase de **desenvolvimento** e confira todas as migrations antes de executar:

~~~bash
npx supabase@latest login
npx supabase@latest link --project-ref SEU_PROJECT_REF
npx supabase@latest db push --dry-run --linked
npx supabase@latest db push --linked
~~~

As migrations estão em **supabase/migrations**. Incluem constraints, RLS, buckets privados, auditoria, controle de consumo e metadados dos anexos.

**Primeiro usuário:** crie a conta no painel Supabase e associe-a a uma organização com papel organization_admin em uma sessão SQL administrativa. Siga exatamente [a documentação de autenticação](docs/AUTHENTICATION.md).

### 3. Funções de servidor

~~~bash
npx supabase@latest functions deploy invite-member
npx supabase@latest functions deploy send-email
npx supabase@latest functions deploy analyze-contract
npx supabase@latest functions deploy extract-document
~~~

Configure segredos **somente no Supabase**: RESEND_API_KEY, RESEND_FROM_EMAIL, OPENAI_API_KEY e, opcionalmente, OPENAI_MODEL e OPENAI_DOCUMENT_MODEL. É necessário um endereço/domínio remetente verificado para enviar e-mails.

- [Documentação das Edge Functions](docs/EDGE-FUNCTIONS.md)
- [Extração de documentos com IA](docs/DOCUMENT-AI.md)
- A análise com IA **envia o conteúdo à OpenAI somente após ação do usuário**; faça revisão de privacidade e de autorização antes de usar documentos reais.

### 4. Iniciar

~~~bash
npm run dev
~~~

Acesse o endereço do Vite exibido no terminal, geralmente **http://localhost:5173**.

## Verificar qualidade

~~~bash
npm run typecheck
npm run lint
npm run build
~~~

A [CI do GitHub](.github/workflows/ci.yml) executa instalação reprodutível, lint, verificação de tipos e build. **Ela não confirma a conexão com um Supabase externo, nem testes funcionais de ponta a ponta.**

## Estrutura do repositório

~~~text
Licits/
├── src/
│   ├── api/dataClient.js            # Gateway Supabase
│   ├── components/                  # UI, contratos, formulários
│   ├── pages/                       # Operação e autenticação
│   ├── contexts/                    # Organização ativa
│   └── lib/supabaseClient.js
├── supabase/
│   ├── migrations/                  # Modelo relacional, RLS e constraints
│   ├── functions/                   # Integrações seguras no servidor
│   └── tests/                       # Testes SQL previstos
├── docs/                             # Segurança e operação
├── .github/workflows/ci.yml         # CI
├── .env.example                     # Exemplo sem segredos
└── package.json
~~~

## Segurança, testes e próximos passos

As verificações SQL em CI criam um Supabase **descartável**, aplicam migrations e simulam contas/organizações diferentes. Validam CRUD, políticas de isolamento, baixa atômica, arquivamento, convites e controles de consumo. **Esses testes não fazem deploy nem exercitam serviços externos.**

**[Manual operacional, backup, restauração e LGPD](docs/PRODUCAO-RECUPERACAO.md)**

O arquivo `scripts/backup-database.sh` gera dump PostgreSQL criptografado via age. Uma rotina de backup efetiva precisa ser configurada no ambiente de destino, incluindo cópia de objetos Supabase Storage e teste de restauração.

- [x] Remover dependência direta do SDK Base44 no frontend.
- [x] Adicionar gateway de dados Supabase com escopo por organização.
- [x] Usar RPC transacional para baixa de itens (sem gravações separadas).
- [x] Criar Edge Functions para integrações que exigem segredos.
- [x] Configurar verificação de tipos, lint e build na CI.
- [x] Aplicar e validar migrations em banco Supabase **local descartável**.
- [x] Testar permissões, isolamento e aceite de convites com identidades de teste em PostgreSQL.
- [x] Cobrir CRUD de contratos, documentos, fiscalização, ocorrências, atas, auditoria e arquivamento com testes SQL.
- [x] Adicionar limites transacionais por usuário/organização para serviços de terceiros.
- [x] Documentar retenção, backup criptografado, recuperação e resposta a incidentes.
- [ ] Validar migrations, autenticação, e CRUD no **projeto Supabase de homologação real**.
- [ ] Implantar Edge Functions e verificar convites, e-mails e IA com provedores e segredos configurados.
- [ ] Agendar backups reais de PostgreSQL **e Storage**, comprovar restauração e configurar monitoramento.
- [x] Implementar projeção financeira e bloqueio atômico de compras acima do valor global.
- [x] Criar fila deduplicada de alertas do teto e distribuição para fiscal/administradores.
- [x] Preparar cenário de licitação fictícia iniciado com 50% utilizado.
- [ ] Implantar no Supabase de homologação e comprovar o envio real de alertas com Resend.
- [ ] Homologar UX ponta a ponta, segurança, custos, LGPD e plano de produção.

**Leia:** [Autenticação](docs/AUTHENTICATION.md) · [Banco](docs/DATABASE.md) · [Segurança](docs/SECURITY.md) · [Migração anterior](docs/MIGRATION_PROGRESS.md)

---

<div align="center">

**LICITS — Gestão Contratual**  
Mantido por [Walter Matheus](https://github.com/WalterMatheusgg) · [GitHub](https://github.com/WalterMatheusgg)

</div>
