> Atualização 0.8.0: consulte [MESSAGING.md](MESSAGING.md) para contatos, números estruturados, conversas sem chat, grupos e notificações. Os detalhes anteriores abaixo são históricos e podem ter sido substituídos.

# Interface interativa — 0.7.0

## Uso

Recarregue todas as sessões com F5. Abra o celular pelo botão lateral ou Alt+P. A primeira tela é o bloqueio visual: toque/clique em Toque para abrir. A seta do topo volta à tela anterior; Início retorna ao launcher e nunca fecha a janela. O ícone de cadeado volta ao bloqueio visual. Fechar e reabrir a janela também bloqueia a tela.

**O bloqueio é apenas visual, sem autenticação por PIN.** Ele não constitui uma barreira de segurança. Nenhum PIN é solicitado ou validado nesta versão. Se `authentication.mode` for `pin` ou `pin.enabled` for verdadeiro, os controladores recusam desbloqueio e operações: não há liberação falsa de uma autenticação futura configurada.

Na tela inicial, mantenha o botão esquerdo pressionado sobre um ícone por aproximadamente 450 ms. Arraste até a célula desejada e solte. O alvo é destacado e o ícone acompanha o cursor. Uma célula ocupada troca de posição; uma vazia conserva as demais posições. Soltar fora da grade cancela. Concluir encerra a organização. Abrir um aplicativo também encerra o modo de organização. Pointer Events suportam mouse e toque; hardware de toque real ainda exige homologação.

Personalização permite prévia de cor principal, destaque, tema claro/escuro e dois papéis de parede independentes. Salvar aparência persiste os valores; voltar sem salvar descarta a prévia. Restaurar cores padrão e Restaurar padrão de cada imagem alteram a prévia, que deve ser salva. Selecionar imagem usa FilePicker v14 respeitando as permissões de arquivos do Foundry, sem conceder privilégios nem oferecer upload. Apenas caminhos relativos de imagens do Foundry são aceitos; URLs externas/S3 não são aceitas nesta entrega. Caminhos inválidos são recusados; arquivo indisponível oculta a imagem e utiliza o fundo padrão.

Layout e aparência pertencem ao ID do aparelho e ficam nos flags do mesmo JournalEntry. Dois usuários autorizados compartilham o layout e aparência desse aparelho; outros aparelhos não são alterados. Transferência e arquivamento preservam os valores. Por exigência desta etapa, a duplicação recebe uma grade própria padrão, sem copiar automaticamente `appLayout`; as demais configurações seguem a cópia integral da versão anterior. Posições de aplicativos temporariamente desabilitados ficam reservadas para sua volta. Células livres são persistidas.

## Permissões e gravações

O mestre configura os aplicativos em Administração > Cell Config > Aplicativos do aparelho. Personalização é essencial e permanece habilitada. Os demais podem ser selecionados individualmente. O catálogo distingue Funcional de Planejado · em breve; Chamadas, WebStudio e AppStudio não executam funcionalidades simuladas.

Jogadores não recebem controles administrativos. Eles só solicitam alterações de aparência, layout ou leitura de notificações. A solicitação via ChatMessage nativo é sussurrada ao autor e aos GMs; o autor é o User do documento Foundry, não um campo fornecido no payload. O GM principal revalida o usuário, acesso atual, situação do aparelho, aplicativos e payload antes de gravar sob o mesmo bloqueio de servidor da numeração. Campos de Actor, ID, PIN, número, permissões e catálogo são recusados nessas solicitações. Aplicativos desabilitados desaparecem da tela inicial/dock e são recusados pelos controladores, pelo envio e pela validação de mensagens no GM, inclusive em pedidos manipulados.

**Um GM deve estar conectado para confirmar alterações feitas pelo jogador.** Sem GM online, a solicitação permanece persistida e a UI informa que ainda está pendente. Ao voltar, o GM processa a fila. A confirmação aceita/recusa a alteração; não há aviso de sucesso prematuro. O acesso é revalidado: um usuário removido enquanto aguardava não consegue salvar. Há limite de 30 solicitações visuais por minuto/autor e proteção contra reprocessamento do mesmo pedido. O mestre pode salvar diretamente, com a mesma validação de campos. Criações e alterações fazem backup/auditoria conforme os serviços existentes.

Desabilitar um aplicativo controla o uso dentro do módulo; não apaga seu histórico nem substitui as permissões nativas do Foundry sobre mensagens/documentos que o usuário já pode ler. Isso não é criptografia ou isolamento contra código privilegiado.

## Relógio

Foi examinada a instalação local do Simple Calendar Reborn **2.6.1**. A integração usa apenas `currentDateTime`, `currentDateTimeDisplay` e, quando necessário, `formatDateTime`, disponíveis na API pública `SimpleCalendar.api`. Os hooks `simple-calendar-date-time-change`, `simple-calendar-clock-start-stop`, `simple-calendar-ready` e `updateWorldTime` atualizam a UI; há também consulta visual a cada segundo enquanto a janela está aberta. Não se chama startClock, stopClock, setDate ou qualquer método de escrita. A hora apresentada vem da API, respeitando pausa e velocidade do calendário, sem extrapolar minutos localmente.

Na ausência/falha real da API, o GM inicializa uma única âncora em `smartphone-rpg.worldClock`, uma configuração persistente do mundo: instante real em milissegundos e instante fictício inicial aleatório. A inicialização é protegida pelo mesmo bloqueio compartilhado. Todos os aparelhos calculam a hora a partir dessa âncora e de `game.time.serverTime`, sem gerar uma hora a cada renderização. O relógio continua transcorrendo durante o período em que o servidor estiver desligado, como um relógio contínuo. Não há dependência obrigatória do calendário. Antes da primeira inicialização por um GM, aparece Aguardando o relógio do mundo. Falhas da API geram um aviso de console por episódio e fallback automático, sem toast repetitivo.

A data/hora da campanha aparece na barra, no bloqueio e no início. A permissão administrativa de leitura do aplicativo Calendário continua aplicável ao aplicativo; o relógio da campanha não consulta notas ou eventos privados.

## Notificações

O sino abre/fecha uma central com título, mensagem, data e estado de leitura por usuário. Sem registros, aparece Nenhuma notificação. O bloqueio visual não mostra conteúdo de notificações. Usuários sem acesso ao aparelho não podem listar nem marcar registros como lidos. Não são geradas mensagens/chamadas fictícias automaticamente.

API extensível do módulo, acessível por `game.modules.get('smartphone-rpg').api`:

- `getAppCatalog()` retorna descritores do catálogo atual.
- `openApp(phoneId, appId)` utiliza o controlador e exige aparelho aberto/desbloqueado e aplicativo habilitado/implementado.
- `saveLayout(phoneId, layout)` e `saveAppearance(phoneId, appearance)` usam a validação autorizada. Para jogador, o retorno pode ser `{pending: true, requestId}`.
- `clock()` retorna `time`, `date` e origem `calendar`, `fiction` ou `pending`.
- `listNotifications(phoneId)` lista somente para o usuário corrente autorizado.
- `markNotificationRead(phoneId, notificationId)` solicita a leitura para o usuário corrente.
- `addNotification(phoneId, {title, message, source})` é exclusivo do GM. Integrações futuras podem utilizá-lo sem simular um serviço ainda inexistente.

Novos campos são opcionais em registros antigos: layout, aparência, seleção de aplicativos e notificações recebem defaults somente na leitura. Não há migração que altere números ou IDs por causa da interface.

## Arquivos criados/modificados

Na pasta do módulo:

- Criados: `scripts/apps.mjs`, `scripts/clock.mjs`, `scripts/presentation.mjs`, `scripts/presentation-view.mjs`, `scripts/launcher.mjs`, `scripts/player-phone.mjs`.
- Modificados: `scripts/main.mjs`, `scripts/core.mjs`, `scripts/foundry-numbering.mjs`, `scripts/device-view.mjs`, `styles/device.css`, `module.json`, `README.md`.
- Testes: criado `tests/interactive.test.mjs`; modificados `tests/numbering.test.mjs`, `tests/relay.test.mjs`, `tests/device-view.test.mjs`; criadas imagens de teste `tests/fixtures/home.svg` e `tests/fixtures/lock.svg`.
- Este documento: `INTERFACE.md`.

## Validação executada

**101 testes automatizados aprovados**, incluindo as regressões existentes. Os novos cenários cobrem relógio fictício persistente em estado reconstruído, API de calendário simulada avançando/pausada/falhando, layout com vazios e sem sobreposição, clique rápido, timer de 450 ms, encaixe/cancelamento do ponteiro, navegação/trava, cores e caminhos, controle de aplicativos, solicitações nativas de jogador processadas pelo GM em ambiente simulado, acesso revogado, payload administrativo forjado, idempotência, notificações por usuário, transferência, arquivamento e compatibilidade com registros antigos.

No navegador, usando a classe de interface real com dados fictícios e armazenamento em memória, foram executados: bloqueio/desbloqueio, clique rápido em aplicativo, retorno, prévia e salvamento de tema/destaque, fallback de arquivo ausente, central aberta/fechada/leitura, troca de aparelho, ocultação de Mensagens na tela e dock de um aparelho sem afetar o outro, e revisão visual de celular/tablet. Foi corrigido o contraste do tema claro e revisada a grade na largura de tablet. Essa prévia não grava dados no mundo Foundry e não substitui validação do FilePicker nativo ou do banco real.

Também foram executados verificações de sintaxe e os validadores locais já existentes que utilizam o sanitizador e operadores reais do Foundry v14.

## Homologação manual ainda necessária no Foundry

1. Recarregue GM e jogadores. Abra dois aparelhos. Confirme relógios iguais, bloqueio inicial, retorno e menus Cell Config somente para GM.
2. Em mundo de teste com Simple Calendar ativo, avance e pause pelo próprio calendário; confira data/hora/velocidade no celular. O Smartphone não deve controlar o calendário. Teste sem o módulo e após reiniciar: a âncora fictícia deve permanecer.
3. Como jogador autorizado, organize ícones com toque longo e mouse, solte em célula livre/ocupada e fora da grade, conclua e reabra. Teste também em um dispositivo de toque real. Outro usuário autorizado do mesmo aparelho deve ver o layout após a confirmação do GM.
4. Salve cores, tema e imagens independentes pelo FilePicker nativo. Volte para conferir o início, bloqueie para conferir a outra imagem; restaure padrões e salve. Confira após reiniciar o Foundry. Arquivos ausentes devem mostrar o fundo padrão.
5. Como GM, desabilite aplicativos em um aparelho. Confira ausência no dock/tela inicial e retorno da posição ao reabilitar, sem afetar o segundo aparelho. Recursos planejados não devem abrir.
6. Desconecte o GM e envie uma alteração visual: deve ficar pendente. Reconecte o GM e confira a confirmação. Teste revogar acesso antes do processamento em um mundo de teste.
7. Confira notificações vazias e integração real pelo método GM addNotification. A leitura de um usuário não deve conceder acesso a outro nem habilitar aplicativos.
8. Transfira, arquive e restaure o aparelho; confira mesmos IDs, números, layout e aparência, mantendo as restrições de acesso e sessões das versões anteriores.

**Pendentes:** sessão completa do Foundry com Simple Calendar realmente ativo, FilePicker com as permissões reais dos jogadores, arraste físico na janela do Foundry, hardware de toque, dois clientes reais simultâneos e reinício real do servidor. Não são marcados como homologados apenas pelos testes automatizados ou pela prévia.
