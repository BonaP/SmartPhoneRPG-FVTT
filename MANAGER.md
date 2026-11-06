# Gerenciador de aparelhos — 0.5.1

Na versão 0.6.0, veja também [LIFECYCLE.md](LIFECYCLE.md): há exclusão definitiva e, na lista de arquivados, somente Restaurar/Excluir definitivamente. A restauração mantém as configurações atuais, mas invalida sessões antigas de acesso.

Exclusivo do GM. Abra Configurações do módulo > Gerenciar aparelhos. A aba Aparelhos continua sendo a tela inicial; Cell Config e o menu … do celular continuam disponíveis ao mestre.

- Pesquisa imediata por nome/apelido ou telefone completo/parcial. Nome ignora caixa e acentos; telefone ignora formatação e considera os dígitos normalizados, incluindo DDI.
- Filtros combináveis: Actor por UUID, sem proprietário, referência excluída; situação Ativos (padrão), Arquivados ou Todos. Cadastros sem campo `archived` são ativos.
- Abrir permite ao GM consultar o celular selecionado. Editar mantém o ID. Salvar volta à lista; Cancelar / Voltar descarta campos ainda não salvos. O botão já existente Salvar somente o vínculo continua sendo uma gravação explícita independente.
- Duplicar pede confirmação, cria um cadastro persistente e abre sua edição. Cancelar a edição posterior não apaga a cópia já criada. A partir da versão 0.5.1, todas as configurações e dados armazenados no cadastro são copiados integralmente: Actor, usuários autorizados, contatos, PIN, credenciais, personalização, preferências, permissões, bloqueio, arquivamento, auditoria e campos adicionais. O nome recebe `- Cópia`; ID e número são novos. Os objetos da cópia são independentes do original. Mensagens do chat Foundry são documentos externos vinculados ao ID original e não são duplicadas por esta operação.
- Arquivar pede confirmação, preserva o diário, número, Actor e configurações. Não equivale a excluir ou bloquear: o estado de bloqueio anterior permanece. O número arquivado continua reservado. Usuários não conseguem usar o aparelho arquivado; o GM pode consultá-lo, mas também não pode enviar mensagens nem consultar calendário por ele. Restaurar retira o arquivamento e preserva as configurações anteriores.

O armazenamento continua nos JournalEntry e no registro existentes. Alterações usam o mesmo bloqueio de página no servidor e leem os dados atuais após adquiri-lo. Conflitos simultâneos retornam erro para repetir depois. Não há fila silenciosa que sobrescreva dados. Arquivar/restaurar cria backup do diário antes de gravar e acrescenta `{operation, at, userId}` em `flags.smartphone-rpg.data.archiveAudit`. Repetir a mesma situação não acrescenta auditoria redundante. O serviço valida o usuário GM; jogadores não recebem as ações administrativas nem as permissões de atualização dos diários.

## Validação automatizada

Execute `node --test tests/*.test.mjs` na pasta do módulo. Abrange busca completa/parcial, caixa, acentos, formatação, filtros combinados, edição e unicidade, cópia integral das configurações e dados, ausência de referências mutáveis compartilhadas, reserva de números arquivados, preservação/restauração/auditoria, negação a jogadores e concorrência entre instâncias. Persistência é verificada por reconstrução de estado simulado; esse teste não reinicia o Foundry real.

## Validação no Foundry v14

1. Recarregue o navegador com F5 após instalar e entre como GM. Abra Gerenciar aparelhos. Confira a lista inicial, sem editor e sem arquivados.
2. Crie um aparelho de teste com nome `Celulár do Pédro`, um número livre e Actor; crie outro sem Actor. Busque o nome completo, `pedro`, `PEDRO`, parte do telefone e o telefone formatado. Combine com cada filtro de Actor, Sem proprietário e situação; confira mensagem sem resultados.
3. Edite nome e número; salve e confira a lista. Tente o número de outro aparelho e confira recusa. Salve mantendo o próprio número. Confira que ID, Actor, PIN/personalização e histórico anteriores permanecem. Altere um campo e cancele: não deve persistir. Não clique em Salvar somente o vínculo se deseja cancelar esse vínculo.
4. Clique Duplicar e cancele a confirmação: nenhum cadastro deve surgir. Confirme depois: deve abrir a cópia com número/ID novos e as mesmas configurações, Actor, usuários, contatos, PIN e personalização. Confira o original intacto e edite uma configuração da cópia para confirmar a independência. Cliques repetidos enquanto a confirmação/gravação está aberta não devem criar múltiplas cópias. Ao duplicar um arquivado, a cópia também permanece arquivada.
5. Arquive o aparelho de teste e confirme. Ele deve sumir de Ativos e aparecer em Arquivados/Todos. Confira o mesmo número/Actor/ID, histórico e configurações. Tente atribuir esse número a outro aparelho: deve ser recusado. O registro archiveAudit e um diário de backup devem existir.
6. Na sessão de jogador, confira a ausência do aparelho arquivado e a ausência de Cell Config/administração. Uma mensagem pendente destinada a aparelho arquivado deve ser recusada pelo GM. Restaure como GM: confira o acesso anterior e o histórico, mantendo eventual bloqueio que já existia.
7. Salve e feche/reabra o Foundry e as sessões. Confira nome/número/ID, cópia, estado de arquivamento, Actor e auditoria. Este passo é o teste de persistência real após reinício.
8. Se houver dois GMs autorizados, tente gravar simultaneamente: uma operação poderá retornar ocupação; repita após terminar a primeira e confira números únicos e preservação dos demais campos. Não use recuperação de bloqueio enquanto houver gravações ativas.

Nenhum teste automatizado substitui a verificação visual, duas sessões reais ou o reinício do servidor. Esta atualização não altera bancos de mundos durante a instalação nem arquivos do sistema Invencibel RPG.
