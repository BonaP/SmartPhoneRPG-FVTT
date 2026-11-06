> Atualização 0.8.0: consulte [MESSAGING.md](MESSAGING.md) para contatos, números estruturados, conversas sem chat, grupos e notificações. Os detalhes anteriores abaixo são históricos e podem ter sido substituídos.

# Contatos pessoais — 0.7.1

Jogadores com acesso ao aparelho podem abrir Contatos, informar um número cadastrado no mundo e salvar um apelido. DDI começa em 55 e DDD em (11), com máscara automática. O apelido inicial é NOME DO CONTATO. Salvar novamente o mesmo número atualiza o apelido; Editar apelido preenche o formulário.

O GM define Contatos: DDI padrão e Contatos: DDD padrão nas configurações do módulo. Use 1 a 3 dígitos no DDI e dois no DDD. Valores inválidos voltam ao padrão na abertura do formulário. Esses padrões só preenchem novos contatos, sem renumerar aparelhos ou alterar a geração automática existente.

Agenda pessoal persistente por usuário e aparelho em personalContacts; contatos legados do GM permanecem compartilhados, com apelidos pessoais sobrepostos apenas para seu autor. Outros jogadores não veem esses apelidos na interface. O GM mantém a supervisão técnica; isso não é armazenamento criptografado.

O GM conectado valida número normalizado contra aparelhos ativos no mundo e grava com bloqueio, backup e auditoria existentes. Sem GM conectado, a solicitação fica pendente. É possível cadastrar um número sem ter permissão de abrir o aparelho destinatário; o GM resolve e confere o destino. O envio também verifica a agenda pessoal do autor. Não é possível adicionar número inexistente, próprio, arquivado ou bloqueado. Até 200 contatos pessoais por usuário/aparelho.

Arquivos criados: scripts/contacts.mjs, tests/contacts.test.mjs e CONTACTS.md.
Arquivos alterados: scripts/core.mjs, scripts/presentation.mjs, scripts/foundry-numbering.mjs, scripts/main.mjs, scripts/player-phone.mjs, scripts/device-view.mjs, styles/device.css, tests/numbering.test.mjs, module.json e README.md.

Testes automatizados: isolamento de apelidos, atualização sem duplicar, formatação equivalente, permissões, app desabilitado, payload adulterado, número inválido/inexistente/próprio, persistência reconstruída, preservação de número/Actor/acessos e envio por agenda do autor. Execução real com dois jogadores, recarga do Foundry e fila offline deve ser homologada no mundo; os testes usam simulações.

Teste manual: atualize todos os clientes; GM configura padrões; Alice adiciona o número de Bob; Alice define Amigo, outro jogador define Colega no mesmo aparelho; confira nomes distintos e envio. Edite o apelido, reabra e confira persistência. Tente número inexistente e verifique recusa pelo GM.
