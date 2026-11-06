# Vínculo entre aparelhos e Actors — implementação 0.4.0

A instalação anterior usa diários `JournalEntry` com dados em `flags.smartphone-rpg.data`, registro `smartphone-rpg.devices` e `actorId` obrigatório no serviço de salvamento. Esta atualização mantém essa arquitetura, os IDs dos aparelhos e toda a numeração única com DDI. Não modifica o sistema Invincible ou documentos de Actor.

## Uso pelo mestre

1. Recarregue todos os clientes após atualizar. Abra **Administração → Gerenciar aparelhos** pelo menu ou pelo ícone de ajustes no celular do GM.
2. No cadastro, **Personagem proprietário** é opcional. Escolha **Sem personagem** ou qualquer Actor válido do mundo, independentemente do tipo. Nome e retrato aparecem abaixo.
3. Para editar um aparelho existente, selecione-o na listagem. Escolha outro personagem ou **Sem personagem** e clique **Salvar somente o vínculo**. Essa ação não envia os demais campos do formulário; alterações pendentes neles não são gravadas nem descartadas.
4. Use **Filtrar por personagem** na listagem. Há opções para todos, sem personagem, referências indisponíveis e cada personagem do mundo. Filtrar atualiza apenas a listagem, preservando o formulário atual.
5. O botão geral **Salvar aparelho** continua salvando o cadastro inteiro, incluindo o vínculo selecionado. Um mesmo Actor pode aparecer em quantos aparelhos o GM desejar.

## Persistência e exclusão

O aparelho guarda `actorUuid: "Actor.<id>"` ou `null`, `actorId` como referência legada compatível e `actorLinkVersion: 1`. O UUID é autoritativo: `actorUuid: null` significa desvinculado mesmo que um dado legado conflitante exista. São aceitos apenas Actors presentes na coleção de Actors do mundo; UUIDs de compêndios, tokens sintéticos, Items ou Actors inexistentes são recusados quando se tenta atribuir um vínculo novo. Tipos `superhero`, `npc`, `minions`, `challenge` e `vehicle` são aceitos sem dependência de atributos de combate.

A migração converte `actorId` antigo para UUID sem renumerar ou mudar outros campos. Antes de atualizar qualquer aparelho, cria um backup integral exclusivo dos GMs. A migração é idempotente e mantém referências a Actors já excluídos, para que o GM possa identificá-las e substituí-las. A migração de números anterior continua separada; se houver números ainda não migrados para DDI, ela mantém seu procedimento próprio.

Excluir um Actor não executa exclusão nem atualização de aparelhos. A referência passa a mostrar **Personagem excluído ou indisponível**; o número e o aparelho permanecem. Salvar outras configurações preserva essa referência inalterada sem exigir que o Actor volte a existir. O GM pode desvincular ou escolher outro Actor. Nome/retrato não são copiados permanentemente, portanto refletem renomeações e mudanças de imagem. O vínculo fica limitado ao mundo atual; mover um aparelho entre mundos ou importar/exportar Actors exige remapeamento pelo GM.

## Autorização e preservação

Somente o GM pode alterar vínculos. O painel não é oferecido aos jogadores, e o serviço também verifica a autorização. Vincular um Actor **não concede nem remove acesso ao aparelho ou à ficha**. Os usuários autorizados ao celular continuam sendo configurados separadamente. PINs, dados de aplicativos e personalizações desconhecidos pelo módulo são preservados.

API adicionada: `game.modules.get('smartphone-rpg').api.setActorLink(phoneId, actorUuidOrNull)` e `migrateActorLinks()`. Ambas exigem GM. A operação isolada usa o mesmo bloqueio de gravação da numeração, consulta os dados atualizados no servidor, preserva backup e atualiza somente os três campos de vínculo. Ela não chama a geração/migração de números e não altera nome, ID, ownership, telefone ou outros flags. Edições diretas de flags por um GM/macros de terceiros continuam fora dessa validação.

## Validação

Execute `node --test tests/*.test.mjs` na pasta do módulo. Os testes exercitam o serviço e o adaptador Foundry com documentos/banco simulados, além da renderização HTML dos controles. Os testes anteriores de numeração, DDI, concorrência, bloqueio e mensagens permanecem na suíte.

Foram acrescentados casos para: aparelho sem Actor; vários aparelhos por Actor; todos os cinco tipos locais; vincular/substituir/desvincular; preservação integral de dados ao salvar somente o vínculo; recusa de jogador; rejeição de referência externa/inválida; exclusão de Actor seguida de edição segura; migração com backup sem renumeração; idempotência; reconstrução de sessão simulada; falha de backup; prioridade do UUID; filtro e apresentação de nome/retrato com escape de HTML.

Esses testes não equivalem a um reinício real do servidor nem a teste visual completo no Foundry. Não se excluem Actors reais do usuário para testar este requisito. A conferência em jogo pode usar um Actor descartável, um aparelho de teste e o roteiro acima; o teste de exclusão e a limpeza desse Actor ficam sob controle do mestre. Resultados reais adicionais, quando executados, são relatados separadamente na entrega.
