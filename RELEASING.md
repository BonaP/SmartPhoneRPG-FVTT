# Publicar uma atualização para o Foundry

O endereço permanente consultado pelo Foundry é:

https://github.com/BonaP/SmartPhoneRPG-FVTT/releases/latest/download/module.json

Esse endereço aponta para o manifesto da release estável mais recente. Commits na main, sozinhos, não publicam uma atualização.

Para a próxima versão:

1. Aumente version no module.json e a versão exposta pela API em scripts/main.mjs.
2. Atualize download no manifesto para a tag correspondente, por exemplo releases/download/v0.8.2/smartphone-rpg.zip. Mantenha manifest inalterado.
3. Execute node --test tests/*.test.mjs e valide o manifesto.
4. Faça commit, envie main e crie/envie a tag v0.8.2 nesse mesmo commit.
5. Crie a release estável dessa tag no GitHub e anexe module.json e smartphone-rpg.zip. O ZIP precisa conter module.json na raiz, além dos scripts, estilos, documentação e licença; nunca inclua .git, backups, dados de mundos, chaves ou credenciais.
6. Publique a release como latest e confira os dois downloads públicos. Releases draft/prerelease não são o canal de atualização estável.

A primeira publicação configurada neste projeto é 0.8.1. Não foi criada automação agendada nem token permanente adicional.
