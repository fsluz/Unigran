import 'dotenv/config';
import { readQuery, typeqlDatetime, writeQuery } from '../src/db/typedb.js';

const courses = [
  {
    id: 'eng-software',
    code: 'ESW-301',
    name: 'Engenharia de Software',
    description: 'Arquitetura, requisitos, qualidade e entrega continua em projetos reais.',
    color: '#2563eb',
    tags: ['Projetos', 'Scrum', 'Qualidade'],
    period: '2026.1',
    schedule: 'Segunda e quarta - 19:00',
    room: 'Laboratorio 04',
  },
  {
    id: 'banco-dados',
    code: 'BDA-204',
    name: 'Banco de Dados',
    description: 'Modelagem, SQL, normalizacao, transacoes e bancos modernos.',
    color: '#0891b2',
    tags: ['SQL', 'Modelagem', 'Transacoes'],
    period: '2026.1',
    schedule: 'Terca - 19:00',
    room: 'Sala B12',
  },
  {
    id: 'ia-aplicada',
    code: 'IAP-410',
    name: 'IA Aplicada',
    description: 'IA generativa, embeddings, avaliacao, etica e automacoes academicas.',
    color: '#16a34a',
    tags: ['IA', 'Embeddings', 'Automacao'],
    period: '2026.1',
    schedule: 'Quinta - 20:00',
    room: 'AVA ao vivo',
  },
];

async function ensureInstitution() {
  let rows = await readQuery(`
    match $institution isa educational-institute, has academic-institution-code "unigran";
    fetch { "institution": { $institution.* } };
  `);
  if (rows.length) return;
  rows = await readQuery(`
    match $institution isa educational-institute, has name "UNIGRAN";
    fetch { "institution": { $institution.* } };
  `);
  if (rows.length) {
    await writeQuery(`
      match $institution isa educational-institute, has name "UNIGRAN";
      insert $institution has academic-institution-code "unigran";
    `);
    return;
  }
  await writeQuery(`
    insert
      $institution isa university,
        has id "institution-unigran",
        has page-id "unigran",
        has username "unigran",
        has name "UNIGRAN",
        has academic-institution-code "unigran",
        has is-visible true,
        has is-active true,
        has can-publish false,
        has page-creation-timestamp ${typeqlDatetime()};
  `);
}

await ensureInstitution();
for (const course of courses) {
  const rows = await readQuery(`
    match $course isa academic-course, has academic-course-id "${course.id}";
    fetch { "course": { $course.* } };
  `);
  if (rows.length) {
    console.log(`Existing course: ${course.name}`);
    continue;
  }
  const tags = course.tags.map(tag => `has academic-tag "${tag}"`).join(',\n        ');
  await writeQuery(`
    match $institution isa educational-institute, has academic-institution-code "unigran";
    insert
      $course isa academic-course,
        has academic-course-id "${course.id}",
        has academic-code "${course.code}",
        has academic-title "${course.name}",
        has academic-description "${course.description}",
        has academic-color "${course.color}",
        ${tags};
      $offering isa academic-course-offering, links (institution: $institution, course: $course),
        has academic-offering-id "${course.id}-2026-1",
        has academic-period "${course.period}",
        has academic-schedule "${course.schedule}",
        has academic-room "${course.room}",
        has academic-status "active";
  `);
  console.log(`Created course: ${course.name}`);
}
