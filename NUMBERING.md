> Atualização 0.8.0: consulte [MESSAGING.md](MESSAGING.md) para contatos, números estruturados, conversas sem chat, grupos e notificações. Os detalhes anteriores abaixo são históricos e podem ter sido substituídos.

# Numeração fictícia — módulo 0.3.2

## Recuperação pela interface (0.3.2)

Foi corrigida a liberação de bloqueio por uma cópia desatualizada do diário. Para limpar um bloqueio remanescente da versão anterior, encerre outras sessões/abas de GM, reinicie o Foundry e use **Administração → Recuperar bloqueio da numeração**. A confirmação explica a condição de segurança. O diário será preservado em backup antes de excluir somente a página de bloqueio reconhecida. O procedimento recusa a exclusão se a página mudar durante o backup. Depois, recarregue o mundo para repetir a migração. A API equivalente é `recoverNumberLock()`, exclusiva do GM e com a mesma confirmação. Não remova o diário-âncora.

## DDI e máscara automática (0.3.1)

O campo **DDI** vem com `55`, pode ser editado para 1 a 3 dígitos e é exibido com `+`. O campo **Número telefônico** recebe o DDD e o número local: os parênteses do DDD e o hífen são inseridos ao digitar. Exemplo final: **+55 (11) 99999-9999**. A máscara preserva a posição do cursor na edição e permite apagar dígitos próximos aos separadores. Colar um número completo com DDI e parênteses atualiza os dois campos; colar os dígitos completos com `+` usa o DDI selecionado. A validação do serviço recusa DDI incompatível com o prefixo colado.

A versão 2 da numeração armazena `countryCode`, `nationalNumberNormalized` (DDD e número), `phoneNumberNormalized` (DDI + DDD + número, só dígitos), `phoneNumber` (formato completo) e `numberingVersion: 2`. A migração dos números da versão 1 adiciona `55`, preservando os dígitos nacionais. Continua usando o mesmo bloqueio e backups antes de modificar aparelhos. A unicidade considera o número completo normalizado; o mesmo número local pode existir com outro DDI se o conjunto completo de dígitos for diferente.

A atualização acrescenta números à estrutura existente sem alterar o sistema Invincible, fichas de Actors ou o formato de mensagens. Cada aparelho continua sendo um `JournalEntry` identificado por seu ID, registrado na configuração de mundo `smartphone-rpg.devices`. O número não pertence ao Actor: transferir o aparelho preserva o ID e o número.

## Uso pelo mestre

1. Reinicie o Foundry e recarregue os clientes. Entre como GM. A migração inicia ao carregar o mundo no GM principal e faz cópias dos aparelhos antes de atribuir números aos legados.
2. Abra **Administração → Gerenciar aparelhos**. No campo **Número telefônico**, digite `(11) 99999-9999` ou `11999999999`. São equivalentes.
3. Deixe o campo vazio para gerar um número. Na edição, o número atual aparece preenchido; mantê-lo não altera a numeração. Apagar o campo pede geração automática; omitir o campo em uma chamada da API mantém o atual.
4. Salve e confira o número na notificação, listagem e informações do aparelho na janela do jogador.
5. Em **Configure Settings**, o **Padrão de números fictícios** controla a geração. Use dígitos fixos e `#` para posições aleatórias: `119########` gera 11 dígitos, com DDD 11 e prefixo 9. Podem ser usados padrões de 10 ou 11 posições. Não existe consulta a operadoras nem validação de números reais.

São aceitos 10 ou 11 dígitos (DDD incluído), espaços, parênteses e hífens. O DDI é informado no campo separado; também são aceitos números completos com `+` e o DDI correspondente. Letras e outros símbolos são recusados pelo serviço. Números com zeros também são permitidos, pois são fictícios. O limite de geração é de 256 tentativas; em caso de colisão o gerador tenta novamente. Ao esgotar as tentativas, a operação falha sem criar um aparelho sem número. Informe outro número ou amplie o padrão.

## Dados e migração

Os campos são adicionados a `flags.smartphone-rpg.data`: `phoneNumber` (formatado), `phoneNumberNormalized` (apenas dígitos) e `numberingVersion: 2`, além de `countryCode` e `nationalNumberNormalized`. Comparação e unicidade usam o valor normalizado. O esquema base do aparelho continua na versão 1. Nenhum PIN é criado por esta atualização; campos de PIN já existentes e personalizações são preservados como dados opacos.

A migração planeja todos os números primeiro, valida duplicidades e preserva os documentos completos em diários exclusivos dos GMs **antes** de modificar os aparelhos. Só escreve os campos de numeração. É idempotente: pode ser repetida sem trocar números já válidos. Uma interrupção entre aparelhos pode deixar a migração parcial; ao reentrar, a migração retoma sem reaproveitar números atribuídos. Se o backup falhar, a alteração não prossegue. Dados preexistentes inválidos/duplicados provocam erro; a migração não decide silenciosamente qual aparelho deve perder seu número.

O salvamento normal passa a preservar campos adicionais do aparelho e permissões de aplicativos desconhecidos pelo formulário. Mudanças explícitas de acesso, contatos e calendário continuam funcionando. Os backups de edição da versão anterior são mantidos. Vínculos, mensagens e contatos continuam usando IDs, portanto renumerar não quebra conversas.

## Concorrência e recuperação

Toda gravação pela UI e pela API `savePhone(id, input)` passa pelo serviço autorizado; jogadores são recusados. O serviço adquire uma página temporária de ID fixo `srpgPhoneWrite01` em um diário-âncora persistente. No núcleo local do Foundry 14.369, a criação de IDs duplicados de **documentos embutidos** é recusada no servidor e as mutações do banco são serializadas. Isso evita que duas instâncias de GM entrem juntas na seção de gravação. O módulo não utiliza a criação de IDs fixos de documentos de primeiro nível como se fosse uma restrição de unicidade.

Depois de adquirir o bloqueio, o serviço consulta documentos e registro de aparelhos novamente no servidor, sem depender apenas do cache da janela. A validação de número, migração, alteração e atualização do registro ocorrem sob esse bloqueio. A operação concorrente pode receber **Numeração ocupada**; basta repetir. Se o número acabou de ser atribuído pelo outro salvamento, a repetição informa que já pertence a outro aparelho. Não há fila automática silenciosa de salvamentos administrativos.

Na primeira inicialização de um mundo com aparelhos, um aparelho existente é marcado como âncora, com backup antes da marcação. O ID é fixado em `numberLockParent`; ele não muda ao criar novos aparelhos ou transferir o aparelho-âncora. Não exclua esse diário diretamente. Num mundo vazio, o GM principal cria um diário exclusivo para controle. Faça essa primeira inicialização com **uma única sessão de GM**, incluindo abas e computadores que usam a mesma conta. A proteção distribuída vale depois de estabelecida essa âncora; o bootstrap de um mundo vazio em múltiplas sessões da mesma conta ainda precisa de teste real e não deve ser feito em paralelo.

Se um cliente cair durante uma operação, o bloqueio pode permanecer. Não há expiração automática: retirar um bloqueio por tempo enquanto o cliente anterior ainda escreve poderia permitir duplicidades. O módulo falha fechado em vez de continuar sem proteção. Recuperação pelo GM: feche todas as sessões, reinicie o servidor para encerrar operações anteriores e preserve/exporte o diário-âncora. Antes de retomar os salvamentos, remova somente a página temporária **Smartphone RPG · gravação em andamento** de ID `srpgPhoneWrite01`. Não remova o diário nem o marcador `numberLockAnchor`. Reabra o mundo e repita a migração. Se o diário foi excluído ou a configuração alterada, restaure o backup; não crie uma nova âncora para contornar o erro.

Não existe uma nova restrição SQL/índice de banco customizado: a proteção é do serviço do módulo, apoiada no bloqueio de documentos embutidos do núcleo. Um GM que edite flags diretamente, execute macros para ignorar o serviço, apague o bloqueio durante uma operação ou use uma versão antiga carregada do módulo pode contornar as regras. Recarregue **todos** os clientes após atualizar. Não misture versões ativas. Se outro módulo alterar os mesmos dados diretamente, será necessária integração com este serviço.

## Testes e limites da validação

Com Node.js, execute `node --test tests/*.test.mjs` dentro do módulo. O arquivo `tests/numbering.test.mjs` exercita o serviço real e o adaptador Foundry usando documentos, armazenamento e bloqueio de servidor simulados; não substitui o servidor real.

| Cenário solicitado | Validação automatizada executada |
|---|---|
| 1. Número manual | Formato e normalização conferidos |
| 2. Número automático | Padrão configurado conferido |
| 3. Duplicidade | Segundo cadastro recusado |
| 4. Formatações equivalentes | Duplicidade normalizada recusada |
| 5. Alteração | Número livre aceito; ocupado recusado |
| 6. Número mantido | Mesmo número aceito; campos extras preservados |
| 7. Transferência | Actor muda; ID, acesso e número permanecem |
| 8. Reinício | Gravação em arquivo e reconstrução de sessão simuladas; **reinício real do Foundry pendente** |
| 9. Migração | Números únicos, backup e preservação; segunda execução sem alterações |
| 10. Simultaneidade | Duas instâncias com sobreposição forçada: um cadastro, um bloqueio; repetição recusa duplicado |

Há também testes para colisão automática, esgotamento, entrada inválida, proibição a jogador, bloqueio persistente, bootstrap com aparelho existente, falha de backup e conflito preexistente. Os testes anteriores de mensagens e interface são mantidos.

Na tentativa de validação desta entrega, o Foundry local em `localhost:30000` não estava aceitando conexões. Portanto, não foram declarados aprovados os ensaios reais de migração no mundo do usuário, reinício do Foundry, formulário administrativo ou dois clientes conectados. Para concluir a validação em jogo: crie dois aparelhos de teste, tente atribuir o mesmo número em duas sessões de GM, confirme um único cadastro, transfira um aparelho e reinicie o Foundry para conferir permanência do número. Na primeira entrada, confira também os backups e os números dos aparelhos legados.


## Correção 0.6.1: operações do mesmo cliente
Migrações, gravações administrativas, recuperação e entregas de mensagens compartilham uma fila local. Assim o próprio GM não disputa a página de bloqueio consigo mesmo durante a inicialização. O bloqueio persistente no servidor continua protegendo sessões de GMs diferentes. Uma falha não paralisa a fila. A liberação também detecta uma página que permaneceu com o token da operação após uma exclusão vetada.

A atualização não remove automaticamente uma página antiga, pois sua presença também pode indicar uma gravação legítima em outra sessão. Recarregue com F5. Se a ocupação persistir, feche outras sessões, reinicie o Foundry e entre somente como GM. Abra Gerenciar aparelhos > Aparelhos > Recuperar bloqueio da numeração, confirme e recarregue. O diário é copiado antes de remover apenas a página temporária; números e aparelhos são preservados.
