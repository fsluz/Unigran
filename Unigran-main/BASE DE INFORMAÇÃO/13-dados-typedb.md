# Dados no TypeDB

## Objetivo
O TypeDB deve guardar dados vivos da plataforma.

Dados vivos são informações que mudam por usuário, postagem, comunidade ou relação.

## Entidades úteis
- person;
- student;
- professor;
- company;
- course;
- community;
- post;
- project;
- opportunity;
- skill;
- interest;
- goal;
- connection.

## Atributos úteis de pessoa
- username;
- name;
- email;
- bio;
- course;
- semester;
- status;
- objective;
- difficulty;
- avatar-url;
- is-active;
- is-banned;
- can-publish.

## Relações úteis
- user follows user;
- user joins community;
- user creates post;
- user has skill;
- user has interest;
- user applies to opportunity;
- user owns project;
- professor mentors student;
- company publishes opportunity.

## Exemplo de perfil útil
Usuário:
- nome: Vinicius;
- curso: Análise e Desenvolvimento de Sistemas;
- semestre: 3;
- interesses: React, Node, IA, carreira;
- objetivo: conseguir estágio;
- dificuldade: montar portfólio.

## Como RAi deve usar dados
RAi deve personalizar resposta.

Exemplo:
Se o usuário gosta de React e quer estágio, RAi deve sugerir:
- projeto front-end;
- GitHub;
- comunidade de tecnologia;
- vagas de estágio;
- plano de 30 dias.
