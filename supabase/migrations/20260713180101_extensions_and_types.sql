-- Base extensions and controlled domain types.
create extension if not exists pgcrypto;
create type public.organization_status as enum ('active', 'inactive', 'suspended');
create type public.profile_status as enum ('active', 'inactive', 'blocked');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'revoked');
create type public.organization_role as enum (
  'organization_admin',
  'gestor',
  'fiscal',
  'operacional',
  'visualizador'
);

create type public.contract_status as enum (
  'ativo',
  'vencido',
  'encerrado',
  'suspenso',
  'cancelado',
  'em_analise',
  'em_analise_slic'
);
create type public.contract_modality as enum (
  'pregao_eletronico',
  'dispensa',
  'dispensa_com_disputa',
  'inexigibilidade',
  'concorrencia',
  'tomada_precos',
  'convite',
  'registro_precos',
  'outro'
);
create type public.extension_status as enum ('sim', 'nao', 'analise_pendente');
create type public.fiscal_health as enum ('adequada', 'regular', 'baixa');

create type public.document_status as enum ('pendente', 'assinado', 'aprovado', 'rejeitado');
create type public.occurrence_status as enum ('aberta', 'em_analise', 'resolvida', 'arquivada');
create type public.severity_level as enum ('baixa', 'media', 'alta', 'critica');
create type public.fiscal_record_status as enum ('pendente', 'concluido', 'em_andamento');
create type public.notification_priority as enum ('baixa', 'media', 'alta', 'critica');

create type public.price_registration_type as enum ('srp_cfp', 'adesao');
create type public.price_registration_status as enum ('ativo', 'encerrado', 'suspenso', 'em_analise');
create type public.price_group_status as enum ('ativo', 'vencido', 'encerrado', 'suspenso');

create type public.admin_request_type as enum ('edicao', 'exclusao', 'ajuste', 'outro');
create type public.admin_request_status as enum ('pendente', 'em_analise', 'aprovado', 'recusado');

create type public.ai_job_status as enum (
  'pending',
  'processing',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled'
);
create type public.ai_review_status as enum ('pending', 'approved', 'rejected', 'needs_changes');
