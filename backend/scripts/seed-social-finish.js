import 'dotenv/config';
import { typeqlDatetime, typeqlLiteral, writeQuery } from '../src/db/typedb.js';

function esc(v) { return typeqlLiteral(String(v ?? '')); }
function dt(v)  { return typeqlDatetime(new Date(v)); }

const extra = [
  { id: 'bonus-001', user: 'gabrielaozoio',    text: 'Publicado: roteiro completo de apresentacao de projeto com dicas de comunicacao tecnica para nao-tecnicos.', ts: '2026-06-05T09:00:00.000Z' },
  { id: 'bonus-002', user: 'vittonlima',        text: 'Material extra: serie de exercicios de TypeQL do nivel iniciante ao avancado. Publicado no AVA da disciplina.', ts: '2026-06-05T10:00:00.000Z' },
  { id: 'bonus-003', user: 'ana_paula',         text: 'Finalizei meu guia de onboarding para designers entrando em times de desenvolvimento. DM para acesso.', ts: '2026-06-05T11:00:00.000Z' },
  { id: 'bonus-004', user: 'carlos_mendes',     text: 'Aprendi sobre OpenTelemetry: instrumentacao padrao para traces, metrics e logs. Portabilidade de observabilidade real.', ts: '2026-06-05T12:00:00.000Z' },
  { id: 'bonus-005', user: 'isabela_rocha',     text: 'Submetido artigo para congresso de IA educacional. Primeiro paper como autora principal. Aguardando resultado!', ts: '2026-06-05T13:00:00.000Z' },
  { id: 'bonus-006', user: 'marina_alves',      text: 'Dashboard de permanencia em producao real: coordenacao recebeu os primeiros alertas automaticos hoje. Impacto concreto!', ts: '2026-06-05T14:00:00.000Z' },
  { id: 'bonus-007', user: 'joao_silva',        text: 'Completei meu primeiro sprint completo no estagio: planejamento, desenvolvimento, review e retrospectiva. Ciclo real!', ts: '2026-06-05T15:00:00.000Z' },
  { id: 'bonus-008', user: 'lucas_costa',       text: 'App mobile com 4.2 estrelas de media na primeira semana de beta interno. Trabalho que gera resultado mensuravel.', ts: '2026-06-05T16:00:00.000Z' },
  { id: 'bonus-009', user: 'coord_academica',   text: 'Indice de satisfacao 2026.1 em recorde historico: 91% dos alunos recomendam a instituicao para amigos e familiares.', ts: '2026-06-05T17:00:00.000Z' },
  { id: 'bonus-010', user: 'biblioteca_unigran',text: 'Novo servico: recomendacao personalizada de artigos por area de pesquisa. Cadastre seu perfil no portal da biblioteca.', ts: '2026-06-05T18:00:00.000Z' },
  { id: 'bonus-011', user: 'gabrielaozoio',    text: 'Encerramento de ciclo: todos os grupos entregaram. Qualidade acima da media historica. Orgulho genuino desta turma.', ts: '2026-06-06T09:00:00.000Z' },
  { id: 'bonus-012', user: 'vittonlima',        text: 'Retrospectiva do semestre: banco de dados e o que conecta regra de negocio ao mundo digital. Ensinar isso e privilegio.', ts: '2026-06-06T10:00:00.000Z' },
];

async function main() {
  let added = 0;
  for (const p of extra) {
    try {
      await writeQuery(`
        match $author isa person, has username "${esc(p.user)}";
        insert
          $post isa text-post,
            has post-id "${esc(p.id)}",
            has post-text "${esc(p.text)}",
            has post-visibility "public",
            has creation-timestamp ${dt(new Date(p.ts))};
          $link isa posting, links (page: $author, post: $post);
      `);
      console.log('add', p.id);
      added++;
    } catch (e) {
      if (e.message?.includes('already')) { console.log('skip', p.id); }
      else { console.error('err', p.id, e.message?.slice(0, 80)); }
    }
  }
  console.log(`\nAdicionados: ${added}/${extra.length}`);
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
