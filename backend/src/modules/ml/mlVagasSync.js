/**
 * Job de sincronização TypeDB → Python ML.
 * Lê vagas salvas/aplicadas do TypeDB e envia ao serviço Python a cada hora.
 */
import { readQuery, typeqlLiteral } from '../../db/typedb.js';
import { mlSyncVagas } from './mlPythonClient.js';

function safe(v) { return typeqlLiteral(v ?? ''); }

async function fetchVagas() {
  try {
    const rows = await readQuery(`
      match
        $job isa ml-job, has ml-id $id;
        try { $job has academic-title $title; };
        try { $job has ml-company $company; };
        try { $job has ml-job-url $url; };
        try { $job has ml-work-location $location; };
        try { $job has ml-work-model $workModel; };
        try { $job has ml-seniority $seniority; };
        try { $job has ml-source $source; };
      fetch { "id": $id, "title": $title, "company": $company, "url": $url,
              "location": $location, "workModel": $workModel, "seniority": $seniority, "source": $source };
    `);
    return rows.map(r => ({
      id: r.id || '', titulo: r.title || '', empresa: r.company || '',
      url: r.url || '', localizacao: r.location || '', modelo: r.workModel || '',
      senioridade: r.seniority || '', fonte: r.source || 'typedb',
    })).filter(v => v.titulo);
  } catch { return []; }
}

async function runSync() {
  const vagas = await fetchVagas();
  if (!vagas.length) return;
  const result = await mlSyncVagas(vagas);
  if (result) console.log(`[ML sync] ${vagas.length} vagas enviadas ao Python (aceitas: ${result.accepted ?? '?'})`);
}

export function startVagasSync() {
  setTimeout(runSync, 10_000);
  setInterval(runSync, 60 * 60 * 1000);
}
