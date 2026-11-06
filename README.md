> Atualização 0.8.0: consulte [MESSAGING.md](MESSAGING.md) para contatos, números estruturados, conversas sem chat, grupos e notificações. Os detalhes anteriores abaixo são históricos e podem ter sido substituídos.

# Smartphone RPG — 0.4.0

## Vínculo com personagens (0.4.0)

O painel permite criar aparelhos **Sem personagem**, vincular qualquer Actor do mundo, substituir o proprietário ou desvincular. Um Actor pode ter vários aparelhos. O vínculo usa `actorUuid` e mantém `actorId` para compatibilidade. Nome e retrato são lidos do Actor atual; personagens excluídos aparecem como indisponíveis, sem apagar o aparelho.

Na edição, **Salvar somente o vínculo** grava apenas os campos do vínculo, com backup antes da alteração. Número, DDI, ID, PIN, contatos, permissões e personalizações não são reenviados. A listagem tem filtro por personagem, por aparelhos sem vínculo e por referências indisponíveis. A migração dos vínculos antigos ocorre na próxima entrada do GM principal. Consulte [ACTORS.md](ACTORS.md) para estrutura, testes e limites da validação.

## Correção do bloqueio (0.3.2)

Corrige o erro `undefined id [srpgPhoneWrite01] does not exist in the EmbeddedCollection collection`: o módulo usa o diário da coleção ativa e remove a página retornada pela criação, sem consultar uma cópia desatualizada do diário. Um bloqueio deixado pela versão anterior pode exigir recuperação. Feche outras abas/sessões de GM, reinicie o Foundry e abra **Administração → Recuperar bloqueio da numeração**. Confirme somente após encerrar as sessões anteriores. O diário é copiado antes de remover apenas a página temporária; aparelhos e números são preservados. Recarregue o mundo para retomar a migração. Se não houver bloqueio, a opção não modifica dados.

## DDI e formatação automática (0.3.1)

O cadastro possui um campo **DDI**, preenchido com `55` por padrão e editável. Digite apenas o DDD e o número no campo ao lado: os parênteses e o hífen são inseridos automaticamente. Exibição completa: `+55 (11) 99999-9999`. Colar um número completo como `+55 (11) 99999-9999` também funciona. Os aparelhos anteriores recebem DDI 55, com backup antes de alterar dados, sem trocar o DDD ou o número local. A comparação de duplicidades considera todos os dígitos, incluindo o DDI.

## Numeração telefônica (0.3.0)

Cada aparelho possui número fictício persistente, com edição manual pelo GM, geração automática configurável e comparação normalizada. O cadastro administrativo e a janela do jogador exibem o número. Transferir o aparelho não altera sua numeração. A migração dos aparelhos antigos ocorre na próxima entrada de um GM principal, com backups antes de alterar dados.

O salvamento usa um bloqueio compartilhado de documento embutido no servidor; outra gravação simultânea pode receber uma mensagem para tentar novamente. Consulte [NUMBERING.md](NUMBERING.md) para regras, testes executados, limitações, primeira inicialização e recuperação de bloqueio após queda. Todos os clientes devem recarregar a atualização antes de editar aparelhos.

## Interface de jogador (0.2.0)

O botão de **celular** fica na barra lateral esquerda, no grupo de ferramentas de **tokens**, junto da régua. Ele abre a janela **Meu celular** para jogadores e GMs; **Alt+P**, a API `open()` e o menu **Meu celular** fazem o mesmo. A barra depende de uma cena/canvas disponível; o menu e o atalho também funcionam sem uma cena.

A janela pode ser movida e redimensionada pelo Foundry. A tela inicial tem relógio/data reais (atualizados quando a interface renderiza), grade de aplicativos e navegação inferior. Contatos e mensagens usam a mesma autorização e os mesmos documentos da versão anterior. Na largura de celular, a lista de conversas dá lugar ao chat selecionado e possui botão de voltar; a partir de 600 px úteis de conteúdo, lista e chat ficam lado a lado, como em tablet. A grade de aplicativos também se adapta à largura real da janela, não à largura total do navegador.

Rascunhos são preservados em memória por aparelho e contato ao navegar, receber mensagens ou redimensionar. Fechar a janela e abri-la de novo pela barra mantém sua instância; recarregar o mundo apaga rascunhos não enviados. Após envio bem-sucedido do pedido, o rascunho é limpo. O histórico é rolável independentemente da área de escrita e da navegação inferior.

O painel anterior passa a ser **Smartphone RPG — Administração → Gerenciar aparelhos**, exclusivo do GM. O GM também pode abri-lo pelo ícone de ajustes na tela do celular ou pela API `openAdmin()`. O painel mantém as configurações de aparelhos e acessos. Não há migração de dados nesta atualização. Chamadas, WebStudio e AppStudio aparecem desabilitados e marcados como **Em breve**; o calendário mantém o adaptador de leitura com permissão do GM.

Para conferir: recarregue os clientes, escolha ferramentas de tokens e clique no celular; abra Mensagens e um contato; escreva um rascunho, visite Contatos e volte; aumente a janela além de 600 px úteis para confirmar as duas colunas. Confira que um jogador não vê o painel de administração e que o GM continua podendo criar/editar aparelhos. A prévia visual usa dados fictícios e não substitui essa conferência no mundo real.

Primeira entrega em português, destinada ao Foundry VTT 14. Sem dependências obrigatórias, sem serviços externos e sem alterações em sistemas ou Actors existentes.

## Instalação e ativação

O diretório `smartphone-rpg` deve ficar em `Data/modules/smartphone-rpg`, com `module.json` diretamente dentro dele. Reinicie o Foundry para reconhecer um módulo novo. No mundo, abra **Game Settings → Manage Modules**, marque **Smartphone RPG** e salve/recarregue. Abra pela barra lateral, **Alt+P** ou **Game Settings → Configure Settings → Smartphone RPG — Meu celular**. Uma macro de script opcional pode usar `game.modules.get('smartphone-rpg').api.open()`.

## Preparação pelo GM

1. Abra **Administração → Gerenciar aparelhos** nas configurações, ou o ícone de ajustes do celular do GM. Crie um aparelho com nome, Actor e usuários autorizados. O vínculo não concede acesso à ficha do Actor: isso continua nas permissões normais do Foundry.
2. Crie outro aparelho. Pode repetir o mesmo Actor para vários aparelhos. Aparelhos de NPCs podem ter somente acesso do GM.
3. Edite o primeiro e marque o segundo como contato. Configure o sentido inverso para permitir respostas. Salve cada aparelho.
4. Usuários autorizados podem abrir os aparelhos e enviar mensagens aos contatos. Todos os GMs recebem supervisão. Um GM ativo precisa estar com o mundo e o módulo carregados para validar e entregar; destinatários podem estar offline.
5. Para revogar acesso, desmarque o usuário; para suspender envio, marque **Bloquear aparelho**. O GM continua vendo aparelhos bloqueados. Contatos e configuração são administrados pelo GM nesta entrega.

## Roteiro de teste real com dois jogadores

- Crie dois aparelhos de teste e contatos nos dois sentidos; conceda um a cada jogador. Use sessões separadas (por exemplo, janela privativa).
- Envie uma mensagem A → B. Confirme recebimento por A, B e GMs; um terceiro jogador não deve vê-la na interface nem no chat privado. Responda B → A.
- Recarregue os clientes e confirme persistência de aparelhos e mensagens. Confira dois aparelhos ligados ao mesmo Actor.
- Desconecte os GMs. Envie uma mensagem: deve aparecer pendente. Reconecte um GM: deve haver uma entrega. Recarregue o GM: não deve duplicar.
- Revogue o acesso ou bloqueie um aparelho antes de validar uma mensagem pendente: a mensagem deve ser recusada. Teste contato removido e limite de 2.000 caracteres.
- Envie `<script>alert(1)</script>`: deve aparecer como texto, sem executar código.
- Confira as cópias de segurança antes de editar aparelhos e teste com Simple Calendar desativado: o botão deve explicar a indisponibilidade sem impedir mensagens.

## Persistência, preservação e privacidade

- Cada aparelho é um `JournalEntry` independente, em `flags.smartphone-rpg.data`, com versão de esquema 1, Actor ID, acesso, contatos e permissões. O registro de IDs autorizados é uma configuração de mundo gravável pelo GM. Um jogador não pode registrar um aparelho falso apenas criando um diário com flags semelhantes.
- Permissão padrão dos diários: NONE; usuários autorizados: OBSERVER; GMs: OWNER. Apenas o GM altera configurações pela UI. Não edite esses diários diretamente. Contatos incluem apenas ID e apelido do destino; não incluem acesso à ficha do destinatário.
- Antes de atualizar um aparelho, o módulo cria outro diário de backup exclusivo dos GMs com o documento completo anterior. Se o backup falhar, a edição não prossegue. Não existe exclusão automática, migração destrutiva ou limpeza de histórico. Backups podem ser exportados pelo Foundry. Restaurar exige um GM e deve ser feito a partir da cópia preservada.
- Pedidos e entregas são `ChatMessage` nativos com sussurros. O corpo fica em `content`, nunca em flags públicas de Actor/configuração. Flags de mensagens contêm metadados de roteamento. A autoria de pedidos é conferida pelo GM usando `ChatMessage.author`, cujo controle de criação no núcleo local impede um jogador de criar mensagens em nome de outro usuário.
- O GM valida acesso, contato e bloqueio atuais antes da entrega e gera a lista de destinatários a partir das permissões atuais. A tela só mostra entregas com autor GM e `isContentVisible`. Não há socket próprio ou confiança em um ID de usuário informado pelo remetente.
- Privacidade segue o modelo de sussurros e permissões do Foundry; não há criptografia ponta a ponta ou isolamento contra administrador do servidor, outro módulo com código privilegiado ou cliente modificado. Não use para segredos reais. Metadados não devem conter dados sensíveis.
- Revogar acesso não apaga mensagens já entregues a um usuário. Novos usuários de um aparelho não herdam mensagens que não lhes foram endereçadas. Todos os usuários autorizados ao aparelho no momento de uma entrega recebem a conversa.
- Mensagens e pedidos também aparecem no chat privado padrão do Foundry. Limpar/excluir o chat remove o histórico correspondente. Apagar comprovantes de entrega preservando pedidos pode permitir reprocessamento. Não use limpeza parcial dos documentos como arquivamento.

## Extensões e limites

- API pública congelada: `open()`, `openAdmin()`, `send(fromId, toId, body)`, `calendarNow(phoneId)` e `version`. Evento local `smartphoneRPGMessageDelivered` publica somente IDs, sem corpo. Não é um mecanismo de autorização nem um canal remoto. Integrações não devem automatizar chamadas de `send` sem intenção explícita do usuário.
- Simple Calendar: adaptador opcional de **somente leitura**, protegido pela autorização por aparelho. Reconhece `foundryvtt-simple-calendar-reborn` e o ID original; detecta `SimpleCalendar.api.currentDateTime`. Não modifica datas/eventos e não concede acesso adicional aos dados publicados pelo calendário. A UI mostra o resultado da API; apresentação temática é uma evolução futura.
- Chamadas: reservadas; não há áudio, sinalização ou uso de microfone nesta versão. Próxima extensão deve reutilizar o relay autenticado e adicionar consentimento e estado versionado.
- WebStudio: reservado para páginas fictícias em documentos do mundo. Não existe acesso à Internet, iframe remoto, importação de HTML ou execução de scripts.
- AppStudio: reservado para definições declarativas versionadas e capacidades concedidas pelo GM. Ainda não há editor, instalação ou execução de aplicativos. Não executar `eval`, macros, HTML arbitrário, código de jogador ou callbacks externos como se fossem sandbox. Cada nova capacidade deve ser validada no relay e negada por padrão; configuração de calendário não autoriza outras integrações.
- Múltiplos GMs: um líder ativo ordenado por ID valida os pedidos em sequência; resultados persistidos evitam reentrega normal após reconexão. Não há transação distribuída: duas abas do mesmo GM ou troca simultânea de líder durante gravação podem causar duplicatas raras. Use uma aba por GM. Limite atual: 20 entregas por autor por minuto; UI mostra as últimas 200 entradas por aparelho. Não há paginação, anexos, confirmação de leitura, bloqueio remoto criptográfico ou sincronização externa.
- Actors removidos deixam o vínculo indisponível até o GM editar o aparelho. Não há dependência dos atributos de combate nem alteração em `actor.system` ou `actor.flags`. Não há suporte particular a tokens não vinculados: os aparelhos se vinculam aos Actors do mundo.

## Análise da instalação local em 22/10/2026

Foundry **14.369**, conforme `Logs/diagnostics.json` e log de inicialização. Mundo encontrado: **Vencível** (`vencivel`), sistema `invincible`, versão de sistema do mundo 2.1.8.

Sistema: **Invincible - Superhero Roleplaying**, ID exato **invincible**, versão **2.1.8**. `system.json` declara mínimo **14** e verificado **14.368**. Isso é uma declaração do sistema, não um teste completo do módulo em 14.369. O módulo foi implementado para as APIs v14 e declara 14.369 como alvo; a validação real dentro de um mundo deve seguir o roteiro acima.

Estrutura: `system/invincible.mjs` registra `InvincibleActor` de `system/documents/actor.mjs` e modelos em `system/models/actors/`. Tipos `superhero`, `npc` e `minions` usam a base de Actor com `attributes.<atributo>.value`, `derived.<recurso>.value/max`, `biography`, `civilianName`, `role`, `appearance`, `reputation`, `karma`, `resources`, `occupation`, `personality`, `drive`, `flaw`, `relationships`, `team`, `teamBase`. Os modelos derivados podem acrescentar campos; a base é suficiente para esta integração, que usa apenas ID/nome do documento. `challenge` tem `derived`, `subtitle`, `biography`; `vehicle` tem `derived.health`, `type`, `passengers`, `maneuverability`, `speed`, `armour`, `cost`, `biography`. Há Items embutidos e ActiveEffects; o módulo não os toca. O sistema personaliza também ChatMessage; o módulo usa `CONFIG.ChatMessage.documentClass` para respeitar essa personalização.

Simple Calendar Reborn encontrado: `foundryvtt-simple-calendar-reborn` **2.6.1**, mínimo/verificado **14**. Encontrado na pasta não significa ativo no mundo.

O histórico recuperado tinha referências sem o texto das respostas anteriores. A arquitetura segue os requisitos explícitos do pedido atual, sem presumir detalhes ausentes.

## Validação reproduzível

Com Node.js: `node --check scripts/main.mjs` e `node --test tests/*.test.mjs`, executados a partir desta pasta. Os testes usam documentos/coleções e parser DOM simulados: validam política, escape, offline, deduplicação, revogação e rejeição de autoria não autorizada. Não substituem ensaio multicliente no Foundry. A tela local está protegida por senha de administrador; nenhum mundo existente foi ativado ou alterado para os testes.


### Administração e Cell Config (0.4.1)
O painel do mestre abre na aba Aparelhos, com a lista completa e filtro por personagem. Clique em Criar novo aparelho para abrir um cadastro vazio; o aparelho só será criado ao salvar. Clique em um aparelho listado para editar. A aba Cell Config contém a edição, separada da lista. Na janela Meu celular, o mestre acessa as configurações do aparelho selecionado pelo menu nativo de três pontos (…) > Cell Config. Jogadores não recebem essa opção.

### Pesquisa, cópias e arquivamento (0.5.0)
O gerenciador permite pesquisa imediata por nome/apelido ou telefone, filtros combinados por Actor e situação, ações Abrir/Editar/Duplicar/Arquivar/Restaurar e cancelamento de campos não salvos. Desde 0.5.1, cópias preservam integralmente as configurações e os dados do cadastro, incluindo Actor, acesso de jogadores, contatos, PIN e personalizações, com ID e número novos. Mensagens externas do chat permanecem vinculadas ao aparelho original. Arquivados preservam dados e reservam o número; restauração mantém configurações e histórico. Arquivamento e restauração geram backup e auditoria. Consulte [MANAGER.md](MANAGER.md) para os detalhes e o roteiro de validação no Foundry.

### Exclusão definitiva e integridade (0.6.0)
O mestre pode excluir aparelhos pela lixeira no canto do cartão, mediante modal com aviso de irreversibilidade e opções Excluir/Cancelar, sem digitação. A operação remove cadastro, mensagens associadas e backups internos do aparelho; guarda apenas auditoria mínima e permite retomar uma limpeza interrompida. Restaurar arquivados valida a numeração e preserva o mesmo ID e as configurações atuais, sem reativar sessões antigas ou permissões revogadas. Arquivados apresentam somente Restaurar e Excluir definitivamente. Consulte [LIFECYCLE.md](LIFECYCLE.md) para comportamento, limitações, falhas e homologação pendente no Foundry.

### Inicialização sem disputa local (0.6.1)
Migrações e mensagens agora aguardam as operações do mesmo cliente numa única fila, evitando o erro de página srpgPhoneWrite01 já existente por concorrência do próprio GM. O bloqueio entre sessões permanece. Uma página órfã preexistente ainda exige recuperação segura conforme NUMBERING.md.

### Confirmação do arquivamento (0.6.3)
A verificação captura os campos de flags antes de chamar Document.update, que acrescenta _id ao objeto de atualização no Foundry v14. O metadado não é mais comparado com flags do celular. Isso corrige o falso erro de armazenamento após arquivar/restaurar e alterar vínculo. Tentativas anteriores podem ter gravado o arquivamento mesmo com o erro; confira o filtro Arquivados após recarregar. O aviso de dimensões da janela é independente desta falha.

### Interface interativa (0.7.0)
Relógio do calendário ou fictício persistente do mundo, bloqueio explicitamente visual, launcher com toque longo, Personalização com cores/temas e papéis independentes, retorno, central de notificações e catálogo de aplicativos por aparelho. Jogadores solicitam gravações visuais, validadas e confirmadas pelo GM; sem GM conectado, ficam pendentes. Catálogo e campos administrativos continuam exclusivos do mestre. Consulte [INTERFACE.md](INTERFACE.md) para funcionamento, arquivos, testes e homologação manual pendente.

Contatos pessoais 0.7.1: consulte [CONTACTS.md](CONTACTS.md).

Auditoria do alvo Foundry 14.368: [COMPATIBILITY.md](COMPATIBILITY.md). Compatibilidade funcional ainda parcial; sistema local identificado como invincible 2.1.8.
