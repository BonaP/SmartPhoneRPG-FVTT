# Exclusão, restauração e integridade — 0.6.0

## Como usar

Recarregue o cliente com F5. Como GM, abra Gerenciar aparelhos. Ativos oferecem Abrir, Editar, Duplicar, Arquivar e Excluir definitivamente. No filtro Arquivados, as ações são Restaurar e Excluir definitivamente. A exclusão aparece como uma pequena lixeira discreta no canto superior direito do cartão; restauração permanece em verde.

A lixeira abre um modal nativo DialogV2 com aviso de exclusão permanente e impossibilidade de recuperar informações posteriormente. Há somente Excluir e Cancelar, sem campo de digitação. Cancelar é a ação padrão. O serviço continua revalidando o GM e a identidade do cadastro confirmado; renomear o cadastro durante o modal exige abri-lo novamente. A interface impede cliques repetidos e o servidor serializa operações.

Restaurar altera o mesmo JournalEntry, preservando ID, número, Actor, PIN, personalização e permissões atuais. Não reconstitui um backup anterior: usuários cujo acesso foi revogado continuam sem acesso. A restauração valida os campos essenciais, os IDs e a unicidade do número antes de gravar. Campos de sessões antigas `sessions`, `unlockSessions`, `unlockedUsers` e `unlockTokens` são esvaziados/removidos; `accessEpoch` avança. Os demais dados permanecem preservados. Este módulo ainda não implementa um mecanismo de desbloqueio por PIN; esses cuidados impedem reaproveitar os campos legados conhecidos quando essa integração existir.

## O que a exclusão remove

- O cadastro do aparelho e sua entrada no registro de aparelhos.
- Vínculo com Actor, PIN, credenciais, configurações, histórico e sessões contidos no cadastro. O Actor não é alterado nem excluído.
- Pedidos, entregas e recusas de mensagens associados e backups internos cujo `source` é o aparelho. Mensagens compartilhadas envolvendo o aparelho são removidas também do histórico da conversa dos destinatários; os cadastros/configurações dos demais aparelhos não são modificados.
- Referências operacionais: pedidos já removidos não são executados por callbacks antigos; contatos cujo destino não existe são omitidos da UI e recusados pelo envio. A lista de contatos armazenada nos outros aparelhos não é reescrita silenciosamente.
- Rascunhos locais envolvendo aparelhos removidos/arquivados são descartados. Não existe ainda um agendador de chamadas, desbloqueios ou eventos neste módulo. A integração Simple Calendar somente lê dados, sem criar eventos a excluir. Integrações futuras podem observar `smartphoneRPGDeviceDeleted`, que recebe somente `{id}`.

A exclusão não oferece restauração na interface. O número fica livre depois da conclusão; o ID fica registrado como retirado e não é reutilizado pelo cadastro de novos aparelhos. Backups externos do mundo e exportações feitas pelo usuário não são apagados por esta operação.

## Segurança, integridade e auditoria

O serviço mantém o bloqueio de página do servidor já usado na numeração. Entrega de mensagens também usa esse bloqueio e lê os aparelhos atuais no armazenamento antes de entregar, evitando entregas tardias durante a exclusão. Autorizações administrativas são verificadas no serviço; os diários de auditoria e controle são exclusivos dos GMs.

IDs são os IDs dos JournalEntry originais. Não há campo de ID no formulário. Requisições de gravação com `id`, `_id`, `uuid`, `deviceId`, caminhos pontuados, `flags`, `data` ou `ownership` são rejeitadas. A carga/inspeção e a gravação detectam IDs repetidos no registro e discrepâncias entre o ID do diário e campos internos de ID. Nenhum ID existente é corrigido ou substituído automaticamente. Criação e duplicação usam novos documentos, com verificação contra IDs retirados.

Operações de criação, edição, duplicação, vínculo, arquivamento, restauração e exclusão geram auditoria administrativa. O diário Smartphone RPG · Auditoria administrativa guarda somente operação, ID, nome/número no momento, GM, horário, resultado e token de correlação. Exclusões mantêm também a etapa e o ID retirado. Não há PIN, credencial, corpo de mensagem ou snapshot do aparelho nesse diário. Auditoria antiga dentro do cadastro é preservada até a exclusão; os registros novos completos ficam no diário administrativo.

Em mundos antigos, o primeiro aparelho pode hospedar a página de bloqueio compartilhada. Ao excluí-lo, seus dados, páginas particulares, acessos e registro são removidos; o diário hospedeiro permanece como controle técnico exclusivo dos GMs, sem os dados do celular. Isso preserva o mesmo bloqueio durante a operação e evita duas travas concorrentes. Não exclua manualmente diários de controle/auditoria.

## Falhas e retomada

Foundry não oferece transação única entre diários, configurações e mensagens. Antes de excluir, o módulo grava uma intenção administrativa mínima. Depois desativa o cadastro, limpa os dados associados, remove o aparelho, retira o registro e verifica novamente o armazenamento. Sucesso só é informado após essa verificação e a gravação do resultado.

Se uma etapa falhar, o serviço retorna erro com ID e etapa, mantém o diagnóstico e não informa sucesso. Use **Retomar exclusões interrompidas** na administração: o botão pede confirmação e conclui somente exclusões anteriormente autorizadas. Funciona inclusive se o diário do aparelho já foi removido e restou atualizar o registro. Não recria aparelhos ou dados apagados. A carga do mundo avisa sobre pendências, mas não executa exclusões automaticamente. Um bloqueio órfão de uma sessão interrompida continua exigindo o procedimento de recuperação documentado em NUMBERING.md.

## Testes executados e homologação pendente

76 testes automatizados aprovados. Abrangem: exclusão de ativo/arquivado e vinculado, cancelamento e confirmação sem campo de texto no modal, preservação de Actor/outros cadastros, persistência simulada, negação a jogadores, restauração com ID/número/configurações, rejeição de número em conflito e dados inválidos, requisições de ID manipuladas, não reutilização de ID retirado, concorrência, falhas em limpeza/registro/commit, retomada e remoção de sessões antigas. Regressões de busca, cópia integral, contatos, numeração e relay também são executadas.

Validação adicional local: os utilitários reais do Foundry v14 foram executados para conferir a aplicação de ForcedDeletion em sessões, preservação de PIN e revogação de ownership; o sanitizador real foi executado na verificação de mensagens. Isso não equivale a validar o modal, o banco e a sessão completos dentro do Foundry.

### Roteiro no Foundry v14

1. Crie um aparelho descartável chamado `Teste exclusão`, vincule a um Actor e autorize um jogador. Anote o ID pelo console do GM ou exporte o diário temporariamente; o módulo não torna o ID editável. Não use um aparelho real para este teste.
2. Clique na lixeira do cartão: confira o aviso de exclusão permanente e os botões Excluir e Cancelar, sem campo de texto. Cancele e confirme que nada mudou. Abra novamente, clique Excluir e confirme o desaparecimento. Confira que o Actor e outro aparelho continuam intactos.
3. Crie outro descartável; arquive e selecione Arquivados. Confira somente Restaurar/Excluir definitivamente. Restaure e confira o mesmo ID, número, Actor, configurações e permissões; nenhum novo aparelho deve surgir. Teste excluir outro descartável arquivado.
4. Na sessão de jogador, confira que não há ações administrativas e que o aparelho excluído não abre nem envia/recebe mensagens. Mantenha uma conversa aberta durante a exclusão para conferir a retirada do destino e do histórico associado. Revogue o acesso de um aparelho arquivado antes de restaurar e confira que o jogador continua sem acesso.
5. Feche e reinicie o Foundry e reconecte as sessões. O excluído não deve reaparecer; o restaurado deve conservar ID/número/configurações. Confira auditoria administrativa e os resultados.
6. Se houver dois GMs, tente editar e excluir o mesmo descartável simultaneamente: uma operação poderá receber ocupação. Não recupere a trava enquanto uma gravação estiver ativa. A operação recusada não pode recriar o excluído.

Conflitos e falhas de armazenamento devem ser simulados na suíte automatizada, sem corromper o mundo de uso. Execute `node --test tests/*.test.mjs` na pasta do módulo.

**Checklist de homologação no Foundry: pendente** para modal/fluxo visual, sessões reais e reinício do servidor. Os quatro critérios não são marcados como totalmente homologados somente pelos testes automatizados.
