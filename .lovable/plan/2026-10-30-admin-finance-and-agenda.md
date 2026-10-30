# Agenda como início e financeiro administrativo — 2026-10-30

## Navegação da clínica
- A rota autenticada `/app` encaminha para `/app/agenda`.
- A Agenda é o primeiro item de navegação para desktop e mobile.
- O antigo resumo do Painel foi preservado como `/app/visao-geral`, com o rótulo “Visão geral”.
- O arquivo `src/routeTree.gen.ts` registra a nova rota. O TanStack Router pode regenerá-lo durante o build/editor.

## Financeiro administrativo da clínica
- A função `adminFinanceSummary` em `src/lib/admin.functions.ts` é uma server function protegida por autenticação e pela verificação `platform_admin`.
- Os valores de movimentação cobrem os últimos 30 dias (datas de pagamentos/recebimentos e despesas).
- Recebido líquido = recebimentos (`kind=receipt`) menos estornos (`kind=refund`).
- Saldo operacional = recebido líquido menos despesas não arquivadas.
- “A receber” é uma estimativa distinta: soma do saldo de agendamentos recentes com situação financeira pendente/parcial, usando `final_amount` e, se ausente, `expected_amount`, descontando pagamentos e estornos vinculados.
- O painel administrativo exibe totais consolidados e uma linha por clínica; a página de detalhes exibe o recorte da clínica selecionada.
- Não houve alteração de schema nem migration. Isso representa o financeiro operacional das clínicas, não receita de assinatura/MRR da plataforma; a estrutura de cobrança da plataforma ainda precisa ser definida antes de apresentar esse tipo de número.

## Orientação para futuras sessões Lovable
Preserve essas rotas e definições de cálculo ao continuar o trabalho. Não substitua os indicadores por dados mockados, não confunda valores previstos com recebidos e mantenha a autorização administrativa no servidor.

## Faturamento separado por Laser Day
- A server function protegida `adminLaserDayEvents` agrupa atendimentos por clínica e pela data local de `appointments.starts_at`, usando o timezone cadastrado na clínica.
- O painel geral do administrador e a página de detalhes da clínica mostram uma linha por Laser Day, sem somar datas diferentes numa única linha.
- Faturamento registrado usa `final_amount` e, quando não existe, `expected_amount`; recebimento líquido é a soma de recebimentos menos estornos vinculados aos atendimentos do evento; pendente é a diferença positiva entre o faturamento registrado e o recebido líquido.
- Um pagamento/estorno vinculado a um atendimento afeta o evento correspondente, sem mudar a data original do atendimento.
- Nenhuma tabela ou migration nova foi necessária. O painel ainda depende de os atendimentos e valores serem registrados pela clínica; a visão ajuda a conferir, mas não prova por si só que nenhum atendimento foi omitido.
