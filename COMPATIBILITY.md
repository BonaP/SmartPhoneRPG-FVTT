> Atualização 0.8.0: consulte [MESSAGING.md](MESSAGING.md) para contatos, números estruturados, conversas sem chat, grupos e notificações. Os detalhes anteriores abaixo são históricos e podem ter sido substituídos.

# Auditoria de compatibilidade — Smartphone RPG 0.7.2

## A. Ambiente identificado

- Data da auditoria: 27/10/2026.
- Windows; Foundry instalado: geração 14, build **368**, canal stable, conforme resources/app/package.json.
- Sistema instalado: **Invincible - Superhero Roleplaying**, ID **invincible**, versão **2.1.8**; o próprio manifesto do sistema declara verified 14.368.
- Não foi localizada uma instalação Invencibel RPG 3.6.8 na pasta Data/systems. A versão 3.6.8 solicitada **não foi validada** e não foi substituída pela 2.1.8 silenciosamente.
- Smartphone RPG: inicial **0.7.1**, final **0.7.2**.
- Dependência opcional instalada: Simple Calendar Reborn, ID foundryvtt-simple-calendar-reborn, **2.6.1**. Instalação não comprova ativação no mundo.
- Não havia sessão do Foundry acessível no navegador nem janela do Foundry na inspeção de aplicativos. Nenhum mundo foi iniciado ou reiniciado durante esta auditoria.

## Estado inicial e preservação

Backup completo do módulo instalado: `smartphone-auditoria-368-20261027-204141`, na pasta de trabalho Games 2. Inventário SHA256 de todos os arquivos em `audit-368-baseline.json`, também na pasta de trabalho. A cópia de desenvolvimento e a instalação tinham zero divergências antes das mudanças.

Não foram editados bancos de mundos, diários, Actors, configurações persistentes, sistemas ou arquivos do Foundry. IDs, números, vínculos, permissões, PINs, históricos, layouts e personalizações não sofreram migração nesta etapa. Backups por operação e migrações existentes continuam funcionando sob a lógica anterior.

## B. Inspeção e incompatibilidades

Estrutura inspecionada: scripts ES modules em scripts/, estilos phone.css e device.css, documentação e testes. A interface produz HTML em JavaScript; o módulo não carrega templates externos, Handlebars ou arquivos HTML próprios. As imagens SVG em tests/fixtures são dados fictícios de testes.

| Local | Evidência/causa | Medida |
| --- | --- | --- |
| module.json, compatibility | verified 14.369 afirmava homologação em outra build; minimum 14 e maximum 14 aceitavam outras builds sem demonstrar o alvo específico. | Removido verified; minimum e maximum definidos como 14.368. Validado pelo BaseModule real da build 368. Aviso de compatibilidade não verificada pode aparecer, intencionalmente. |
| scripts/main.mjs, API pública | A versão informada pela API precisa acompanhar o manifesto. | Atualizada para 0.7.2, sem alterar os fluxos funcionais. |
| Sistema solicitado | O nome/versão real não corresponde à versão 3.6.8 do pedido. | Documentada a divergência. Sem instalar, atualizar ou modificar o sistema. |

Não foi comprovada outra API incompatível que justificasse substituir mecanismos funcionais. Não houve refatoração, dependência externa ou servidor adicional.

## APIs efetivamente examinadas na instalação 368

- ApplicationV2: _renderHTML(context, options), _replaceHTML(result, content, options), _getHeaderControls(), controles com onClick, close(options) e render(boolean) estão presentes. render(true) é aceito expressamente nesta build; não foi trocado por uma alternativa por suposição.
- FilePicker exportado por foundry.applications.apps, opções callback e allowUpload existentes.
- SceneControls fornece objeto de controles e ferramentas e dispara getSceneControlButtons; ferramentas button/onChange suportadas.
- DialogV2 permanece empregado pelo módulo; nenhuma classe de diálogo legada introduzida.
- ChatMessage possui author e isContentVisible. O sistema registra CONFIG.ChatMessage.documentClass = InvincibleChatMessage, que estende foundry.documents.ChatMessage. O módulo utiliza essa classe configurada e mensagens sem rolls, sem chamar rotinas de combate do sistema.
- JournalEntry/Setting: leitura pelo database.get e atualização de documentos preservadas. A implementação ClientDatabaseBackend._getDocuments foi inspecionada. Essas chamadas de backend têm acoplamento ao Foundry e precisam de validação no servidor real; testes simulados não comprovam o transporte.
- ForcedDeletion, mergeObject com applyOperators e sanitizador cleanHTML executados diretamente das bibliotecas instaladas.
- Hooks init/ready e hooks de documentos/usuários/calendário registrados; setup não é necessário nesta arquitetura, que não importa tipos de dados específicos do sistema.
- Simple Calendar: reader utiliza currentDateTime/currentDateTimeDisplay/formatDateTime quando disponíveis; leitura somente, detecção de falha e relógio fictício persistente mantidos. Ausência do módulo não constitui dependência obrigatória. Sem teste com o calendário ativo nesta etapa.

## Actors e integração com o sistema

Os tipos reais declarados e registrados pelo sistema 2.1.8 são superhero, npc, minions, challenge e vehicle. O módulo não restringe tipos nem lê/escreve actor.system. Obtém nome, imagem, id e UUID dos documentos em game.actors; as referências Actor.<id> são resolvidas nessa coleção. Actors de compêndio ou embutidos não são aceitos como proprietários do mundo.

Os vínculos são flags do aparelho, não propriedades das fichas. Referências a Actor excluído são preservadas sem excluir aparelhos; múltiplos aparelhos podem apontar ao mesmo Actor. Transferência e desvinculação são operações administrativas com GM, backup e validação. Nenhuma ficha ou automação de combate foi alterada.

## C. Arquivos modificados/criados

- module.json: versão 0.7.2 e alvo exclusivo 14.368, sem verified.
- scripts/main.mjs: somente versão exposta pela API.
- tests/compatibility.test.mjs (novo): regressão do manifesto, arquivos referenciados, ausência de dependência obrigatória do calendário e consistência de versão.
- README.md: ligação para este relatório e limitação da homologação.
- COMPATIBILITY.md (novo): este relatório.

Ferramentas locais da auditoria, fora do módulo: audit-manifest-368.mjs (modelo BaseModule real), audit-368-baseline.json (inventário) e install-smartphone-audit-368.ps1 (instalador que recusa arquivos instalados modificados e confere hashes). Nenhuma biblioteca proprietária do Foundry foi copiada para o módulo.

## D. Testes e resultados

**Aprovados:** 107 testes automatizados. Incluem criação/edição e duplicação; numeração manual/automática/única, colisões e formatações equivalentes; concorrência simulada com mutex; backup; preservação de IDs; vínculo/transferência/Actor excluído; arquivamento/restauração/exclusão e retomada; ACL e revogação; solicitações offline e autoria/entrega simuladas; agenda e apelidos por usuário; navegação/bloqueio visual; pointer handlers com 450 ms, encaixe e cancelamento; layout e personalização; aplicativos desabilitados; relógio alternativo e API de calendário simulada. Esses testes usam adaptadores e mocks e não equivalem a um mundo real.

**Aprovados com bibliotecas reais da instalação 368, em processo Node isolado:**

1. BaseModule: manifesto válido; build 368 aceita sem alegação verified; 367 exige upgrade; 369 exige downgrade. Namespaces e primitivas oficiais inicializados para esse teste; não há sessão de jogo.
2. Sanitizador: preserva corpo e marcador das mensagens, com escape e quebras de linha; caminhos de scripts e CSS existem.
3. Operadores de atualização: remoção de sessões e revogação preservam PIN e demais dados do exemplo.
4. Verificação de sintaxe de todos os scripts do módulo.

**Reprovados finais:** zero na suíte executada. Na preparação do validador isolado ocorreram erros de namespaces ausentes do runtime do Foundry; corrigidos no harness ao carregar as bibliotecas oficiais. Não foram erros reproduzidos dentro do Foundry nem correções no módulo.

**Não executados / pendentes:** ativação do módulo e carga do mundo, reinício real e inspeção do console, abertura/renderização/fechamento/reabertura/redimensionamento das janelas no Foundry, criação e exclusão de registros no mundo, FilePicker real, arraste físico, calendário ativo, comunicação entre dois clientes, revogação em sessão e persistência após reinício real. Não foram criados nem removidos dados de teste no mundo do usuário.

## E. Resultado e roteiro no Foundry

**Compatibilidade parcial: auditoria estática e testes locais aprovados para a instalação 14.368. Compatibilidade funcional completa ainda não confirmada. Invencibel RPG 3.6.8 não verificado por ausência dessa versão.**

1. Como GM, recarregue os clientes e confirme Smartphone RPG 0.7.2 na lista de módulos. Pode haver aviso de build não verificada; o manifesto não promete homologação funcional.
2. Abra Administração pelas configurações do módulo; confira os aparelhos já existentes antes de editar.
3. Crie um aparelho de teste, confira número, edite-o, vincule a um superhero e depois a um npc. Confira que ID/número permaneceram estáveis durante transferências.
4. Duplique, arquive e filtre por Arquivados para restaurar. Confira preservação dos dados. Só exclua registros de teste dispensáveis, usando a confirmação da lixeira.
5. Abra o celular pela ferramenta lateral/Alt+P; desbloqueie, navegue, feche e reabra; redimensione; mantenha um ícone pressionado para organizar; salve aparência e reabra.
6. Com jogador, confira acesso somente ao aparelho concedido e ausência de Cell Config. Revogue a concessão como GM e verifique bloqueio. Teste mensagens e contatos com dois clientes e o GM conectado.
7. Sem Simple Calendar ativo, confira relógio fictício. Com o calendário ativo, confira leitura e avanço/pausa sem alterar o calendário pelo celular.
8. Reinicie o Foundry em momento apropriado, reabra e compare aparelhos, números, vínculos, permissões e configurações. Registre qualquer erro do console.

A remoção do campo verified só deve ser revertida depois de homologação funcional documentada no ambiente exato. Para verificar 3.6.8, é necessário disponibilizar e identificar sua instalação real; esta etapa não fez downgrade, upgrade ou download do sistema.
