# Laser Day Pro — Plano técnico (Fase 1)

Sistema multi-clínica em PT-BR (R$, DD/MM/AAAA, 24h, America/Sao_Paulo), mobile-first, com backend Lovable Cloud (banco PostgreSQL, autenticação, RLS e funções de servidor).

## Arquitetura

```text
Navegador (React / TanStack Start)
  ├─ /entrar, /esqueci-senha, /redefinir-senha, /convite   (públicas)
  ├─ /termo/:token                                          (pública, só o documento)
  ├─ /agendar/:slug                                         (pública, Fase 7)
  ├─ /app/*      área da clínica   (protegida + membership ativa)
  └─ /admin/*    área da locadora  (protegida + papel platform_admin)
Funções de servidor (createServerFn)
  ├─ ações admin privilegiadas (criar clínica, convidar, suspender) — verificam papel antes
  ├─ página pública do termo e aceite via token (sem acesso direto às tabelas)
  └─ criação/edição de agendamento com checagem de conflito
Banco: RLS em todas as tabelas, funções SECURITY DEFINER para checagem de papel/clínica
```

## Modelo de dados

Todas as tabelas operacionais têm `clinic_id`, `created_at`, `updated_at`; registros a preservar usam `archived_at` (exclusão lógica).

| Tabela | Conteúdo principal |
|---|---|
| profiles | id (= usuário), nome, telefone |
| user_roles | user_id, role (`platform_admin`) — separado do perfil |
| clinics | nome, slug, responsável, e-mail, telefone, endereço, fuso, duração padrão, `access_status` (ativo/suspenso), notas admin |
| clinic_memberships | user_id, clinic_id, role (`owner`/`staff`), status |
| clinic_invitations | e-mail, clinic_id, token (hash), expira_em, aceito_em |
| rentals | clinic_id, equipamento, início, término, status da locação |
| business_hours / blocked_times | horários de funcionamento e bloqueios |
| clients | nome, telefone normalizado (único por clínica), e-mail, observações |
| appointments | client_id, início, fim (calculado), duração, áreas (lista + texto livre), valor previsto, valor final, notas internas, notas do atendimento, status, status financeiro |
| appointment_events | histórico de alterações (status, horário, valores) |
| payments | appointment_id opcional, valor, forma, data, tipo (recebimento/estorno), avulso, taxa de falta |
| expense_categories / expenses | categorias padrão + personalizadas; despesas |
| message_templates | modelos de WhatsApp por clínica |
| documents / document_versions | rascunho atual; versões publicadas imutáveis (sem UPDATE/DELETE) |
| document_acceptances | token, versão, cliente, agendamento, status (enviado/visualizado/aceito/expirado), data/hora, cópia do conteúdo aceito |
| audit_logs | ator, clínica, ação, registro, data/hora, metadados mínimos (sem senhas/tokens) |
| public_booking_requests | Fase 7 |

## Regras críticas no backend

- **Isolamento**: RLS com `is_clinic_member(clinic_id)` (membership ativa e clínica não suspensa). `clinic_id` nunca é aceito livremente do navegador sem essa checagem.
- **Admin**: `has_role(auth.uid(), 'platform_admin')`; ninguém consegue se promover editando perfil. Acesso de suporte a uma clínica grava log de auditoria.
- **Conflito de horário**: restrição de exclusão no banco (`EXCLUDE USING gist` em intervalos de agendamentos ativos), que bloqueia inclusive requisições simultâneas; bloqueios também são checados.
- **Status separados**: agendamento (aguardando, confirmado, em atendimento, concluído, faltou, cancelado) com transições validadas por trigger; financeiro (pendente, parcial, pago, estornado) recalculado a partir dos pagamentos.
- **Receita** = soma de pagamentos menos estornos. Valor previsto nunca conta. Conclusão ou falta não geram receita automaticamente.
- **Termos**: publicar cria versão imutável; aceite guarda a versão exata. Link usa token aleatório, sem dados pessoais na URL.
- **Auditoria** por triggers em agendamentos, pagamentos, documentos, aceites, acessos.

## Autenticação

- E-mail e senha, recuperação de senha, logout, rotas protegidas.
- Convite: admin cria a clínica → convite por e-mail → responsável define a própria senha. Tratamento de convite expirado/inválido e de clínica suspensa.

## Dependências de configuração

- **E-mail de convite e recuperação**: funciona com o e-mail padrão do Lovable Cloud; para enviar com o domínio da sua empresa é preciso configurar um domínio de e-mail.
- **Primeiro administrador**: após criar sua conta, eu atribuo o papel de admin ao seu e-mail (preciso que me informe qual).
- WhatsApp: apenas links wa.me com texto pronto (sem API, nada enviado automaticamente).

## Fases de entrega

1. Este plano.
2. **Fundação**: Cloud, autenticação, convites, papéis, RLS, layout e navegação, painel admin inicial (clínicas, locações, acessos, auditoria).
3. **Operação**: clientes, agenda (dia/semana/lista), agendamentos, conflitos, status, histórico, WhatsApp.
4. **Financeiro**: pagamentos, estornos, despesas, painel, filtros, CSV.
5. **Documentos**: editor, modelo inicial (marcado como "revisar"), versões, links de aceite, recibo.
6. **Revisão**: testes de isolamento entre duas clínicas, regras financeiras, conflitos, mobile.
7. **Futuro**: link público de agendamento, solicitações, lembretes.

Cada fase termina com relatório do que funciona, testes feitos e pendências.

## Design

Estética clínica elegante: fundo marfim, tons rosé/nude com um verde-sálvia de apoio, tipografia serifada leve nos títulos e sans legível no corpo; navegação inferior no celular e lateral no desktop.

## Detalhes técnicos

- TanStack Start + createServerFn com middleware de autenticação; admin client só dentro de handlers após checar papel.
- Extensão `btree_gist` para a restrição de conflito; `tstzrange(starts_at, ends_at)` em status ativos.
- Datas armazenadas em `timestamptz`, exibidas no fuso da clínica.
- Testes com Vitest para regras puras (cálculo financeiro, WhatsApp, durações) e testes SQL de isolamento RLS.
