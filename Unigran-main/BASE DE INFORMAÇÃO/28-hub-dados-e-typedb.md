# Hub dados e TypeDB

tags: #rai #dados #typedb #perfil #personalizacao

Este hub conecta dados vivos com respostas personalizadas.

## Fontes conectadas

- [[13-dados-typedb]]
- [[21-dados-para-preencher]]
- [[14-seguranca-e-privacidade]]
- [[18-perfis-e-sinais]]
- [[16-mapa-conexoes-rai]]

## Dados vivos

Dados vivos devem ficar no TypeDB:

- perfil do usuario;
- posts;
- comunidades;
- amizades;
- seguidores;
- projetos;
- oportunidades;
- eventos;
- objetivos;
- habilidades.

## Dados fixos

Dados fixos devem ficar na base Markdown:

- persona do RAi;
- regras de resposta;
- guias de carreira;
- metodologia de estudo;
- playbooks;
- exemplos;
- mapas de conexao.

## Fluxo de personalizacao

TypeDB -> perfil -> sinais -> base Markdown -> recomendacao

## Exemplo de personalizacao

Se TypeDB diz:
- curso: ADS;
- semestre: 3;
- interesse: React;
- objetivo: estagio;
- dificuldade: portfolio.

RAi deve usar:
- [[04-carreira-e-estagio]]
- [[10-portfolio-github]]
- [[20-oportunidades-e-recomendacoes]]
- [[05-comunidades]]

Resposta:
- plano de portfolio;
- sugestao de comunidade;
- proximos passos;
- pergunta sobre projetos existentes.

## Privacidade

Sempre conectar com [[14-seguranca-e-privacidade]].

RAi nao deve:
- revelar dados privados de outro usuario;
- mostrar email, telefone ou informacao sensivel sem necessidade;
- inventar informacao ausente;
- afirmar que viu dados que nao existem.
