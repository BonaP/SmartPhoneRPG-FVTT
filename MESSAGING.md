# Smartphone RPG 0.8.0 — Contatos, conversas e notificações

## Entrega e ambiente

Alvo declarado: Foundry VTT **14.368**, Windows, sem servidor adicional e sem dependências externas. O sistema local identificado na auditoria anterior é **invincible 2.1.8** (Invincible - Superhero Roleplaying). **Invencibel RPG 3.6.8 não foi encontrado nem validado**. O módulo usa Actor.id/uuid/name/img e permissões públicas, sem propriedades de combate do sistema e sem alterar suas fichas.

Instalação: Data/modules/smartphone-rpg. Versão anterior 0.7.2; nova 0.8.0. Backup completo anterior à edição em `smartphone-antes-mensagens-20261027-205654`, na pasta Games 2. Inventário/hash inicial: messaging-baseline.json, fora do módulo. Instalação e testes não editam bancos de mundos.

## Funcionalidades

- Cadastro administrativo com DDI, DDD e número local separados. DDI aceita + na entrada, 1–3 dígitos; DDD 1–5; local 3–12 dígitos (espaços/hífens aceitos); completo até 20 dígitos fictícios. Zeros significativos são strings. Unicidade compara todos os dígitos do número completo, independentemente da formatação ou divisão em campos.
- Nas configurações nativas, DDI padrão para novos celulares (+55) e DDD padrão para novos celulares (11), usando StringField validado e escopo world. Só GM salva configurações mundiais. IDs das opções anteriores foram mantidos para preservar seus valores. Padrões servem também aos novos contatos e não renumeram registros existentes.
- Número local vazio gera número novo com a parte local do padrão automático existente (padrão de fábrica: nove dígitos, começando com 9). O DDI/DDD escolhidos no formulário são respeitados; colisões são verificadas dentro do mutex do mundo. Edição isolada conserva número/ID.
- Contatos: botão Adicionar contato, formulário Salvar/Cancelar, foto local opcional via FilePicker, edição, exclusão e pesquisa por nome/número. Aceita número ainda inexistente no mundo, mas recusa entrega para destinatário inexistente, arquivado, bloqueado ou sem Mensagens habilitado.
- A agenda pertence ao aparelho e acompanha transferências. Cada usuário mantém seu próprio apelido, inicialmente NOME DO CONTATO; o GM pode administrar pelo aplicativo Contatos do aparelho. Foto/número são dados da agenda; apelidos pessoais permanecem isolados nas projeções dos usuários. Contatos legados do GM mantêm seu nome compartilhado de base. A interface administrativa encaminha a administração da agenda para o aplicativo, sem regravar as listas legadas ao salvar outros campos.
- Conversas privadas são bidirecionais. O destinatário pode responder pela conversa recebida sem cadastrar contato recíproco. Histórico, autoria, data, identificador e estado entregue ficam persistidos; nenhuma entrega é afirmada antes da validação e gravação pelo GM.
- Grupos: criação com 3–50 aparelhos incluindo criador; nome, imagem local opcional, seleção da agenda ou números completos. Criador é administrador. Administrador ou GM, operando aparelho participante, pode editar dados e participantes; qualquer participante pode sair. Ao sair o administrador, o primeiro membro restante assume. Grupos podem ficar menores depois da criação. NPCs funcionam como quaisquer aparelhos; GM responde selecionando seu aparelho, sem automação de respostas.
- Novos participantes não recebem histórico anterior à entrada. Cada mensagem registra audiência no instante da entrega. Quem sai ou é removido conserva apenas o histórico que efetivamente recebeu e deixa de receber mensagens novas; nunca participantes não recebem projeção da conversa. Retorno posterior não libera mensagens do intervalo de ausência.
- Leitura é individual por aparelho (usuários do mesmo aparelho compartilham leitura), até a última sequência efetivamente exibida; abrir a conversa desbloqueada solicita leitura. Notificações contêm ID, tipo, aparelho, título, resumo, data, leitura e referência à conversa. Abrir notificação leva à conversa; tela bloqueada não exibe conteúdo privado.
- Ferramenta lateral existente: badge vermelho 1–99+, escondido em zero, agrega aparelhos autorizados e não conta a mesma notificação duas vezes por aparelho. Vibração breve em recebimentos novos; respeita prefers-reduced-motion. GM monitora o aparelho selecionado na janela do celular, inclusive depois de fechá-la; não soma automaticamente todos os NPCs do mundo.
- Histórico não lido permanece com celular fechado e é recalculado ao reconectar. Conversas são ordenadas pela última atividade recebida. Para iniciar uma conversa nova, abra Contatos e Enviar mensagem; conversas recebidas aparecem em Mensagens.

## Comunicação sem chat e privacidade

**Nenhuma mensagem nova nem solicitação visual é criada como ChatMessage. Não há socket não autenticado.** O transporte usa flags do próprio documento User, cuja atualização é autenticada pelo servidor do Foundry. A implementação User.#canUpdate/getUserLevel da build 368 foi inspecionada: jogador só atualiza seu próprio User; GM permanece autoridade confiável.

1. Cada perfil de navegador gera chave ECDH P-256; chave privada não exportável fica no IndexedDB local. Somente a pública é registrada em User.flags.smartphone-rpg.messagingKey.
2. Solicitações são criptografadas com AES-GCM-256 e chaves efêmeras ECDH para os GMs registrados, com contexto de mundo/usuário autenticado como AAD. Vão para User.flags.smartphone-rpg.messagingOutbox. O autor é o documento User autenticado; campos de remetente são revalidados pelo controlador GM contra os aparelhos atuais.
3. O GM principal processa a fila sob a fila local e mutex de documento existente, lê a versão autoritativa do cofre pelo backend nativo e valida concessões, aplicativos e membros. IDs processados são persistidos e separados por autor; repetição não duplica mensagens. Limites: 20 operações pendentes por usuário, 30 operações/minuto e 20 mensagens/minuto por remetente/conversa. A própria fila local serializa envios simultâneos; Web Locks é usado quando disponível para múltiplas abas.
4. Um único valor da configuração oculta world messagingVault é gravado atomicamente, contendo estado criptografado para os GMs e projeções criptografadas por usuário autorizado. Requisições reconhecidas são retiradas das flags depois de persistido o resultado. Sem GM conectado, ficam pendentes. Usuários/GM desconectados recebem suas projeções quando reconectarem e registrarem a chave.
5. Projeções não incluem históricos não autorizados nem apelidos de outros usuários. O transporte do Foundry pode distribuir **ciphertext** a outros clientes; conteúdo em texto puro não é distribuído por esse cofre. IDs de usuários, tamanhos e existência de envelopes não são secretos.

Não há promessa de privacidade contra GM, módulos/scripts executados no perfil autorizado, capturas/cópias já recebidas ou backups externos anteriores. Revogação impede novas leituras/entregas no controlador; não apaga cópias que o usuário já recebeu. Bloqueio de tela continua visual, não substitui permissões; PIN permanece não implementado e configurações futuras de autenticação continuam falhando de modo fechado.

## Estrutura e migrações

- Aparelhos permanecem nos mesmos JournalEntries e mesmos IDs, flags e registro. Números novos/editados usam numberingVersion 3 e countryCode/areaCode/localNumber, nationalNumberNormalized, phoneNumberNormalized e phoneNumber. Migração dos antigos acrescenta partes e numberPartsVersion 1 sem mudar os dígitos completos ou IDs. Números v1/v2 continuam reconhecidos; ao editar pelo novo formulário, passam ao formato estruturado v3.
- messagingVault.schema 1 guarda somente envelopes autenticados. Estado interno contém contatos por aparelho, aliases por usuário, conversas, membros/participações, mensagens/audiências/sequências, leituras, IDs processados e resultados. Projeções são reconstruídas com os acessos atuais.
- Na primeira inicialização pelo GM, contatos antigos e apelidos pessoais são copiados à agenda criptografada. Os campos antigos permanecem preservados. Novos aparelhos ganham agenda própria; duplicação copia a agenda por valor e configurações, com ID/número novos e grade padrão. Histórico de conversas não é atribuído ao novo aparelho.
- Entregas antigas autenticadas pelo GM são importadas em ordem, com IDs preservados, sem criar entregas duplicadas. São consideradas já lidas para evitar uma avalanche de avisos antigos. Pedidos antigos de mensagem ainda pendentes são revalidados pelo autor nativo e acesso atual; não são marcados falsamente como entregues.
- Documentos históricos de chat não são apagados. O hook renderChatMessageHTML oculta os tipos de transporte legados do módulo no chat convencional enquanto o módulo estiver ativo; a importação mantém o histórico no aplicativo. Dados legados em chat não ganham confidencialidade retroativa. Pedidos visuais antigos de chat são preservados, mas não são retomados pelo novo transporte; se estavam pendentes, reenviar pela interface.
- Exclusão definitiva continua pelo fluxo auditado existente. Antes de remover o aparelho, limpa agenda, dados próprios do novo histórico, referências de audiência e pedidos associados. Conversa privada associada é removida; grupo retém apenas os dados dos demais aparelhos. Não é possível apagar cópias já recebidas por outro cliente ou backups externos pelo módulo.
- Migrações são preparadas ao carregar o mundo pelo GM, com os backups por operação existentes. Nenhuma foi aplicada a um mundo real durante os testes desta entrega.

## Limitações reais e recuperação

- Primeiro uso precisa de um GM para inicializar as chaves. Entrega e alterações aguardam GM online, automaticamente; não há aprovação manual por mensagem.
- WebCrypto exige localhost ou HTTPS. Em HTTP remoto inseguro, falha explicitamente, sem rebaixar para texto puro. Não foi adicionado servidor externo.
- As chaves são por perfil/origem do navegador e usuário/mundo. Use o mesmo perfil para reconectar. Mudança de navegador, porta/origem ou limpeza do IndexedDB pode perder a chave; backup dos dados do mundo **não contém as chaves privadas**. Se houver um GM com chave válida, ele pode supervisionar uma nova autorização de chave para outro usuário. Não apague a chave pública/estado para contornar uma falha: perder todas as chaves de GM torna o novo cofre indecifrável. O módulo recusa sobrescrevê-lo vazio. Não há assistente automático de recuperação nesta etapa.
- Imagens aceitas são caminhos locais de imagens na biblioteca Foundry; URLs externas/S3 não foram habilitadas. FilePicker respeita permissões nativas.
- Limites de armazenamento: 200 contatos por aparelho, 10.000 mensagens por conversa e aproximadamente 6 MB de estado antes da criptografia. Ao atingir limite, recusa nova alteração sem apagar mensagens antigas. Não há ferramenta automática de exportação/compactação de histórico nesta versão.
- Escrita do cofre lê via backend nativo e grava sob o mesmo mutex dos aparelhos. Escritas fora do módulo ou cliente malicioso com privilégios de GM continuam fora dessa proteção.
- A exclusão não pode revogar dados previamente copiados, nem recuperar conteúdo sem chaves. Novas mensagens são sempre apresentadas apenas no smartphone; registros antigos de chat preservados podem voltar a aparecer se o módulo for desativado.

## Arquivos da entrega

Criados: scripts/phone-parts.mjs, scripts/messaging.mjs, scripts/messaging-crypto.mjs, scripts/messaging-bridge.mjs, scripts/messaging-view.mjs, scripts/phone-badge.mjs; tests/messaging.test.mjs; tests/messaging-bridge.test.mjs; MESSAGING.md.

Modificados: module.json; scripts/main.mjs; scripts/numbering.mjs; scripts/foundry-numbering.mjs; scripts/lifecycle.mjs; scripts/device-management.mjs; scripts/contacts.mjs; scripts/player-phone.mjs; scripts/device-view.mjs; styles/phone.css; styles/device.css; tests/numbering.test.mjs; tests/relay.test.mjs; README.md; CONTACTS.md; NUMBERING.md; INTERFACE.md; COMPATIBILITY.md.

Ferramentas da prévia, inventários, instaladores e capturas ficam fora do módulo, na pasta de trabalho. Não contêm dados do mundo. Não foram copiados arquivos proprietários do Foundry ou do sistema.

## Testes efetivamente executados

**124 testes automatizados aprovados**, zero reprovados finais. Quatro testes do transporte antigo por chat foram substituídos por testes do novo transporte; não são apresentados como aprovados para a arquitetura nova. A suíte restante cobre regressões dos aparelhos, unicidade, backup, transferência, arquivamento/restauração/exclusão, permissões, layout, temas e calendário simulado.

Testes novos usam engine real, WebCrypto real e adaptadores de documentos nativos simulados: internacionalização/zeros/duplicidade e concorrência, migração, contatos desconhecidos/CRUD/apelidos isolados/cópia, privado/resposta, grupos com três aparelhos e NPC, membros/administrador/saída/sem retroativo, idempotência, leitura por aparelho, notificações agregadas, badge/animação/movimento reduzido, fila offline/reconexão, autoria nativa/forja/revogação, projeção não autorizada, adulteração e chave/contexto incorretos, limpeza do histórico e recusa de sobrescrita após perda de chave. O teste do transporte instala um ChatMessage.create que falha se chamado; nenhuma criação ocorreu.

Com bibliotecas reais da build 368, em processo isolado: modelo BaseModule aceita manifesto na 368, sem verified, e recusa 367/369; StringField aceita +55 e DDD 001 e recusa valores inválidos; sanitizador de mensagens legado e operadores de remoção/revogação continuam aprovados. Sintaxe de todos os scripts validada.

No navegador, **prévia com dados fictícios em memória**, utilizando a classe de celular, renderizadores e engine reais: criação de contato com campos separados, conversa privada, envio, grupo de três participantes incluindo NPC, recebimento em outro aparelho, abertura pela notificação e leitura mantendo pendente a outra conversa. Nenhum erro/aviso registrado nessa prévia. WebCrypto e chave privada no IndexedDB foram exercitados e relidos com sucesso. Isso não comprova o servidor Foundry.

### Checklist solicitada

| # | Cenário | Evidência e limite |
|---|---|---|
| 1–5 | Padrões, números alternativos, unicidade e migração | Serviço real com armazenamento simulado; validação de campos com biblioteca real. Configurações e migração no mundo pendentes. |
| 6 | CRUD de contatos | Automatizado; cadastro/abertura também na prévia. |
| 7 | Mensagem privada | Automatizado e prévia. Transporte servidor real pendente. |
| 8–11 | Grupo de três, NPC, entrega e remetentes | Automatizado e prévia; nenhum NPC responde automaticamente. |
| 12 | Persistência após reinício | Estado reconstruído e envelopes relidos em testes; reinício real pendente. |
| 13 | Celular fechado | Fila/notificações independem da janela nos testes; sessão real pendente. |
| 14–15 | Vibração e badge | Handlers reais com DOM simulado; ferramenta lateral real pendente. |
| 16 | Leitura atualiza contador | Automatizado e prévia. |
| 17 | Vários aparelhos | Contagem agregada/deduplicação automatizada. |
| 18 | Reconexão | Transporte simulado e releitura de chave no navegador; reconexão Foundry real pendente. |
| 19–20 | Origem/conversa não autorizada | Engine e transporte simulados recusam; ciphertext não abre com chave alheia real. |
| 21 | Nada no chat | Nenhum ChatMessage novo criado no teste; código de produção não chama criação para transporte; hook de legado testado. Chat real pendente. |
| 22 | Console | Sem erros/avisos na prévia. Console do mundo real ainda não validado. |

## Como testar no Foundry

1. Faça backup do mundo. Recarregue GM e jogadores, confirme módulo 0.8.0 e mantenha um GM conectado durante a primeira inicialização. Em rede remota, use HTTPS; localmente localhost.
2. Nas configurações nativas, altere DDI/DDD padrão. Crie um aparelho de teste com campos separados, outro com códigos diferentes e tente duplicar o número completo. Confira que editar nome/Actor não altera o número.
3. Conceda aparelhos A e B a jogadores distintos e C ao GM/NPC. Abra Contatos de A, use Adicionar contato, cadastre B e um número inexistente; teste pesquisa, editar, foto e excluir. Teste apelidos diferentes com dois usuários autorizados ao mesmo aparelho.
4. No contato de B, Enviar mensagem. Confira balão, autoria e ausência de linha nova no chat tradicional. Com B fechado, envie outra: ícone lateral deve vibrar e exibir badge. Abra B, desbloqueie, abra notificação e responda; confira leitura e contador.
5. Crie grupo em A com B/C. Envie por A, responda por C como GM. Confira todos os remetentes. Como membro comum tente editar (deve ser recusado); como administrador remova B, envie outra e confirme que B não recebe. Adicione novo aparelho e confirme que não recebe histórico anterior. Teste sair e sucessão do administrador.
6. Conceda dois aparelhos ao mesmo jogador para conferir soma. Revogue uma concessão e tente enviar/ler novamente. Desabilite Mensagens em um aparelho e teste a recusa no controlador.
7. Desconecte o GM, envie como jogador e confira aviso de pendência, sem entrega falsa. Reconecte GM e destinatário e confirme uma única entrega.
8. Reinicie o mundo usando o mesmo perfil de navegador. Confira números/IDs/Actors, agenda, aparência, conversas e não lidas. Não limpe IndexedDB como teste de reinício.
9. Só exclua aparelhos de teste dispensáveis, pela confirmação existente; confira limpeza do histórico associada. Registre erros de console e não marque homologação completa antes dessa rodada.

**Estado final: implementação instalada e testes locais aprovados; homologação funcional no Foundry e no sistema 3.6.8 ainda pendente.**
