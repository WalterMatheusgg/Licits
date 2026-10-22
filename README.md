<div align="center">

# 🛡️ NexoFiscal

### Gestão inteligente de contratos e fiscalização

**Uma central para acompanhar contratos, orçamento, prazos, documentos e ocorrências.**

[![Frontend](https://github.com/WalterMatheusgg/Licits/actions/workflows/ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/ci.yml)
[![Banco Supabase](https://github.com/WalterMatheusgg/Licits/actions/workflows/supabase-db-ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/supabase-db-ci.yml)
[![Edge Functions](https://github.com/WalterMatheusgg/Licits/actions/workflows/edge-functions-ci.yml/badge.svg)](https://github.com/WalterMatheusgg/Licits/actions/workflows/edge-functions-ci.yml)

**React 18 · Vite 6 · Supabase Auth · PostgreSQL · Tailwind CSS**

> **Status: em desenvolvimento/homologação.** Recursos implementados no código não significam implantação ou validação no ambiente remoto.

</div>

---

## Navegação rápida

- [O que o projeto resolve](#o-que-o-projeto-resolve)
- [Funcionalidades](#funcionalidades)
- [Instalação e execução](#instalação-e-execução)
- [Configuração do Supabase](#configuração-do-supabase)
- [Inteligência documental e assistente](#inteligência-documental-e-assistente)
- [Alertas por e-mail](#alertas-por-e-mail)
- [API para outros sistemas](#api-para-outros-sistemas)
- [Testes e produção](#testes-e-produção)
- [Documentação](#documentação)

## O que o projeto resolve

O **NexoFiscal** foi desenvolvido para apoiar fiscais de contratos e gestores na rotina de acompanhamento da execução contratual.

| Dificuldade do fiscal | Como o NexoFiscal ajuda |
| --- | --- |
| Não saber quanto ainda pode gastar | Mostra valor contratado, utilizado e saldo disponível |
| Ultrapassar o teto ou a quantidade de um item | Prévia de consumo e baixa controlada por função transacional no banco |
| Perder o prazo de vigência | Painel de vencimentos e fila de alertas |
| Ter ocorrências e comprovantes dispersos | Registros de fiscalização vinculados ao contrato |
| Demorar para cadastrar um contrato | Cadastro manual e importação de PDF/imagem com revisão |
| Precisar prestar contas das alterações | Histórico e auditoria no PostgreSQL |
| Precisar integrar um ERP | API própria com autenticação, escopos e isolamento por organização |

### Exemplo de uso

Um contrato fictício tem **R$ 100.000,00 de valor total** e **R$ 50.000,00 já utilizados (50%)**. O fiscal pode consultar os R$ 50.000,00 restantes, simular o impacto de uma nova compra, acompanhar o consumo por item e receber avisos quando os marcos de **80%, 90% e 100%** forem atingidos. O banco deve rejeitar retiradas acima dos limites previstos.

[Contrato fictício completo para testes](docs/CONTRATO-DEMONSTRACAO.md).

> O sistema oferece apoio operacional; não substitui a análise administrativa, jurídica e documental realizada pelos responsáveis.

## Funcionalidades

| Módulo | Recursos presentes no código |
| --- | --- |
| **Dashboard** | Indicadores, saldos, consumo e vencimentos |
| **Contratos e fornecedores** | Cadastro, pesquisa, edição, itens e acompanhamento |
| **Itens e compras** | Quantidade contratada/utilizada, movimentações e proteção transacional |
| **Fiscalização** | Fila de tarefas, prioridades, prazos, registros, ocorrências e evidências |
| **Atas de registro de preços** | Atas, fornecedores, grupos e itens |
| **Documentos** | Armazenamento privado, PDF, OCR e revisão antes do cadastro |
| **Assistente fiscal** | Consultas estruturadas sobre contratos, riscos, saldo e vencimentos |
| **Mapa** | Visualização aproximada por estado (UF), não por endereço exato |
| **Administração** | Organizações, usuários, permissões e solicitações |
| **Auditoria** | Registro de alterações relevantes no banco |
| **Alertas** | Filas orçamentárias e de vencimento; e-mails após configuração do Resend |
| **Integrações** | API própria para consultar, criar, atualizar e receber contratos externos |

A aplicação usa **Supabase Auth** e políticas **Row Level Security (RLS)** para limitar os dados por organização e papel de usuário.

## Instalação e execução

### Requisitos

**Node.js 22**, npm, acesso ao repositório privado e um projeto Supabase de desenvolvimento ou homologação.

### Novo clone

~~~bash
git clone https://github.com/WalterMatheusgg/Licits.git
cd Licits
npm ci
cp .env.example .env.local
~~~

Se já estiver no **GitHub Codespaces**, dentro de **/workspaces/Licits**:

~~~bash
git pull origin main
npm ci
cp -n .env.example .env.local
~~~

Revise as variáveis públicas do arquivo **.env.local**:

~~~dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
VITE_ENVIRONMENT=development
~~~

Para iniciar:

~~~bash
npm run dev -- --host 0.0.0.0
~~~

- **No computador:** normalmente http://localhost:5173.
- **No Codespaces:** abra **Ports**, localize a porta **5173** e abra o link fornecido.

> **Segurança:** qualquer variável com prefixo **VITE_** pode ficar visível no navegador. Nunca coloque senhas, token administrativo do Supabase, chaves secretas do Resend ou credenciais de serviços no frontend.

## Configuração do Supabase

### 1. Autenticar a CLI

~~~bash
npx supabase login
~~~

Conclua o processo de autenticação e vincule o projeto Supabase apropriado:

~~~bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
~~~

O **dry-run** mostra as migrações pendentes sem aplicá-las.

**Se aparecer o erro:**

~~~text
Access token not provided. Supply an access token by running supabase login.
~~~

A CLI não está autenticada neste terminal/Codespaces. Execute **npx supabase login** e repita os comandos. **Não compartilhe o token no chat ou no repositório.**

### 2. Aplicar migrations

**Depois de revisar a simulação e realizar um backup**, no ambiente de homologação:

~~~bash
npx supabase db push
~~~

As migrations estão em **supabase/migrations/** e incluem RLS, constraints, auditoria, importação documental transacional, controles de consumo e limites para credenciais de integração.

### 3. Criar o acesso inicial

Para abrir o sistema, o usuário precisa de conta no **Supabase Auth**, perfil ativo, vínculo ativo com uma organização e permissões apropriadas. O primeiro administrador e a organização são configurados por sessão administrativa de SQL.

[Instruções para criar o primeiro usuário e organização](docs/AUTHENTICATION.md).

**Nunca desative o RLS para contornar erros de permissão.**

### 4. Implantar funções

Depois de configurar as credenciais seguras e aplicar as migrations necessárias:

~~~bash
npx supabase functions deploy invite-member --use-api
npx supabase functions deploy send-email --use-api
npx supabase functions deploy integration-contracts --use-api --no-verify-jwt
npx supabase functions deploy dispatch-budget-alerts --use-api --no-verify-jwt
npx supabase functions list
~~~

A função de integração autentica tokens de usuários ou credenciais próprias internamente. A função de alertas exige o segredo de agendamento no cabeçalho. A opção **--no-verify-jwt** não remove essas verificações do código.

## Inteligência documental e assistente

**Não é necessário contratar a API do ChatGPT/OpenAI para utilizar o assistente interno e o cadastro documental local.**

- **Assistente interno:** responde a perguntas estruturadas sobre dados disponíveis ao usuário. Não é um modelo generativo treinado localmente.
- **PDFs:** o PDF.js lê texto dos arquivos.
- **Imagens e PDFs digitalizados:** o Tesseract.js executa OCR com idioma português.
- **Revisão humana:** número, fornecedor, CNPJ, valor, vigência, itens e cláusulas extraídos devem ser conferidos antes de salvar.

Os arquivos enviados ficam no Storage privado. O cadastro de contrato, documento e itens usa uma operação SQL transacional. Como o envio do arquivo ocorre antes da transação, uma falha de gravação pode deixar um arquivo pendente de limpeza.

[Como funciona a extração local](docs/DOCUMENT-AI.md).

## Alertas por e-mail

O banco possui filas para alertas de orçamento e de vencimento. **O envio externo somente funciona após configurar e validar o serviço.**

Para habilitar, configure no **Supabase Edge Function Secrets**:

| Variável | Finalidade |
| --- | --- |
| **RESEND_API_KEY** | Credencial privada da conta Resend |
| **RESEND_FROM_EMAIL** | E-mail remetente em domínio verificado |
| **ALERT_DISPATCH_SECRET** | Segredo aleatório (32+ caracteres) para o agendador |
| **NEXOFISCAL_PUBLIC_URL** | URL HTTPS pública do sistema (opcional) |

Também é necessário implantar a função **dispatch-budget-alerts** e configurar o workflow **.github/workflows/budget-alerts.yml**.

**Atenção:** o agendador do GitHub ainda usa os nomes legados de secrets **LICITS_DISPATCH_URL** e **LICITS_ALERT_DISPATCH_SECRET**. Confira o [guia de alertas](docs/ALERTAS-FISCAL.md) antes de modificá-los.

## API para outros sistemas

A **API NexoFiscal v1** usa Edge Functions Supabase, sem dependência do ChatGPT.

~~~text
POST https://SEU-PROJETO.supabase.co/functions/v1/integration-contracts
~~~

| Operação | Função |
| --- | --- |
| **list** | Consultar contratos e aplicar filtros |
| **create** | Cadastrar contrato e fornecedor |
| **update** | Atualizar os campos permitidos |
| **ingest** | Receber um contrato em JSON genérico de integração |
| **create_credential** | Emitir token próprio para integração |
| **revoke_credential** | Revogar acesso de integração |

Exemplo de consulta (use um token válido da organização):

~~~bash
curl -X POST \
  "https://SEU-PROJETO.supabase.co/functions/v1/integration-contracts" \
  -H "apikey: SUA_CHAVE_PUBLICAVEL" \
  -H "Authorization: Bearer SEU_TOKEN_VALIDO" \
  -H "Content-Type: application/json" \
  -d '{"operation":"list","organization_id":"UUID_DA_ORGANIZACAO","page":1,"per_page":25}'
~~~

As credenciais externas possuem escopos de leitura/escrita, revogação e limite de requisições por minuto. A ingestão genérica ainda **não** é um conector específico homologado para SAP, TOTVS ou outros ERPs.

- [Manual da API](docs/API-INTEGRACAO-V1.md)
- [Especificação OpenAPI](docs/openapi-integration-v1.json)

## Arquitetura

~~~mermaid
flowchart LR
    P["Fiscal / Gestor"] --> UI["React + Vite"]
    UI --> AUTH["Supabase Auth"]
    UI --> G["Gateway de dados"]
    G --> DB[("PostgreSQL + RLS")]
    G --> ST["Storage privado"]
    UI --> LOCAL["OCR e assistente interno"]
    ERP["Integrações externas"] --> EDGE["Edge Functions autenticadas"]
    EDGE --> DB
    CRON["Agendador"] --> EMAIL["Worker de alertas"]
    EMAIL --> DB
    EMAIL --> RESEND["Resend"]
~~~

## Testes e produção

Verifique o código antes de qualquer implantação:

~~~bash
npm ci
npm run build
npm run lint
npm run typecheck
node --test tests/*.test.js
npm audit
~~~

- **Build e lint aprovados** não comprovam funcionamento no Supabase remoto.
- **Testes unitários** cobrem somente os cenários escritos.
- **Testes SQL** e de isolamento são executados pela CI em ambiente local isolado.
- **npm audit** identifica riscos nas dependências; não execute **npm audit fix --force** sem analisar as mudanças.

**Antes de produção:** aplicar e testar migrations em homologação, validar cada papel e organização, testar importações e compras concorrentes, confirmar e-mails reais, garantir backups/restauração e conferir os logs das Edge Functions.

## Estrutura do repositório

~~~text
Licits/                         # Nome técnico atual do repositório
├── src/
│   ├── api/                     # Gateway de dados
│   ├── components/              # Componentes de interface
│   ├── contexts/                # Organização ativa
│   ├── lib/                     # OCR, assistente e utilitários
│   └── pages/                   # Dashboard e módulos do sistema
├── supabase/
│   ├── migrations/              # PostgreSQL, funções, RLS
│   ├── functions/               # APIs e alertas
│   └── tests/                   # Testes SQL
├── tests/                       # Testes unitários
├── docs/                        # Guias
├── .github/workflows/           # CI e agendamentos
└── package.json
~~~

## Documentação

| Guia | Para que serve |
| --- | --- |
| [Acesso e autenticação](docs/AUTHENTICATION.md) | Conta, organização e permissões |
| [Banco de dados](docs/DATABASE.md) | Tabelas e migrations |
| [Segurança](docs/SECURITY.md) | Autorização e isolamento |
| [Extração de documentos](docs/DOCUMENT-AI.md) | PDF, OCR e revisão |
| [Alertas](docs/ALERTAS-FISCAL.md) | Resend e agendamento |
| [Integrações](docs/API-INTEGRACAO-V1.md) | Operações e tokens da API |
| [Produção e recuperação](docs/PRODUCAO-RECUPERACAO.md) | Backup e restauração |
| [Checklist de homologação](docs/PLANO-PRODUCAO-NEXOFISCAL.md) | Pendências antes da publicação |

---

<div align="center">

**NexoFiscal — Mais controle, rastreabilidade e organização na fiscalização contratual.**

Desenvolvido e mantido por [Walter Matheus](https://github.com/WalterMatheusgg).

</div>
