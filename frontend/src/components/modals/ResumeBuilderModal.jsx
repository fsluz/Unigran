/**
 * ResumeBuilderModal — formulário inteligente de currículo.
 * Substitui o upload de PDF/DOCX por dados estruturados inseridos pelo usuário.
 * Salva via POST /uploads/resume/structured.
 */
import { useState } from 'react';
import { apiFetch, authHeaders } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

const EMPTY_FORM = {
  name:        '',
  email:       '',
  phone:       '',
  objective:   '',
  education:   [{ institution: '', course: '', year: '' }],
  experience:  [{ company: '', role: '', period: '', description: '' }],
  skills:      [],
  projects:    [{ title: '', description: '', link: '' }],
};

function TagInput({ values, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  };
  const remove = (tag) => onChange(values.filter(t => t !== tag));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          placeholder="Ex: React, Python, SQL..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>+ Add</button>
      </div>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {values.map(tag => (
            <span key={tag} style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tag}
              <button type="button" onClick={() => remove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontWeight: 900 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start', marginBottom: 10 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 8, fontWeight: 600 }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function ResumeBuilderModal({ initial, token, onSave, onClose }) {
  const { showToast } = useToast();
  const [form, setForm]   = useState(() => {
    if (initial?.virtualResume) {
      const vr = initial.virtualResume;
      return {
        name:       vr.name        || '',
        email:      vr.email       || '',
        phone:      vr.phone       || '',
        objective:  vr.about       || vr.objective || '',
        education:  (vr.education?.length  ? vr.education  : EMPTY_FORM.education),
        experience: (vr.experience?.length ? vr.experience : EMPTY_FORM.experience),
        skills:     vr.hardSkills  || vr.skills || [],
        projects:   (vr.projects?.length   ? vr.projects   : EMPTY_FORM.projects),
      };
    }
    return { ...EMPTY_FORM };
  });
  const [saving, setSaving] = useState(false);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const setArrayField = (key, idx, subKey, val) => {
    const arr = [...form[key]];
    arr[idx] = { ...arr[idx], [subKey]: val };
    setField(key, arr);
  };

  const addRow = (key, empty) => setField(key, [...form[key], { ...empty }]);
  const removeRow = (key, idx) => setField(key, form[key].filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Nome obrigatório', '!'); return; }
    try {
      setSaving(true);
      const res = await apiFetch('/uploads/resume/structured', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar currículo');
      showToast('Currículo salvo!', 'OK');
      onSave?.(data.resume, data.analysis);
      onClose();
    } catch (err) {
      showToast(err.message || 'Falha ao salvar', '!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: 680, maxHeight: '88vh', overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Construtor de Currículo</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Preencha os dados — o currículo é gerado automaticamente.</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Dados pessoais */}
        <Section title="Dados Pessoais">
          <FieldRow label="Nome completo">
            <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Seu nome completo" />
          </FieldRow>
          <FieldRow label="E-mail">
            <input className="form-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="seu@email.com" />
          </FieldRow>
          <FieldRow label="Telefone">
            <input className="form-input" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+55 11 99999-0000" />
          </FieldRow>
          <FieldRow label="Objetivo">
            <textarea className="form-input" rows={3} value={form.objective} onChange={e => setField('objective', e.target.value)} placeholder="Descreva seu objetivo profissional..." style={{ resize: 'vertical' }} />
          </FieldRow>
        </Section>

        {/* Formação */}
        <Section title="Formação Acadêmica">
          {form.education.map((ed, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10, position: 'relative' }}>
              {form.education.length > 1 && (
                <button type="button" onClick={() => removeRow('education', i)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Instituição</label>
                  <input className="form-input" value={ed.institution} onChange={e => setArrayField('education', i, 'institution', e.target.value)} placeholder="UNIGRAN, USP..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Curso</label>
                  <input className="form-input" value={ed.course} onChange={e => setArrayField('education', i, 'course', e.target.value)} placeholder="Análise e Desenvolvimento..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Ano (conclusão)</label>
                  <input className="form-input" value={ed.year} onChange={e => setArrayField('education', i, 'year', e.target.value)} placeholder="2026 / Em andamento" />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addRow('education', { institution: '', course: '', year: '' })}>+ Adicionar formação</button>
        </Section>

        {/* Experiência */}
        <Section title="Experiência Profissional">
          {form.experience.map((ex, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10, position: 'relative' }}>
              {form.experience.length > 1 && (
                <button type="button" onClick={() => removeRow('experience', i)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Empresa</label>
                  <input className="form-input" value={ex.company} onChange={e => setArrayField('experience', i, 'company', e.target.value)} placeholder="Nome da empresa" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Cargo</label>
                  <input className="form-input" value={ex.role} onChange={e => setArrayField('experience', i, 'role', e.target.value)} placeholder="Dev Frontend, Estágio..." />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Período</label>
                  <input className="form-input" value={ex.period} onChange={e => setArrayField('experience', i, 'period', e.target.value)} placeholder="Jan/2024 – atual" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Descrição</label>
                  <textarea className="form-input" rows={2} value={ex.description} onChange={e => setArrayField('experience', i, 'description', e.target.value)} placeholder="O que você fez nessa posição..." style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addRow('experience', { company: '', role: '', period: '', description: '' })}>+ Adicionar experiência</button>
        </Section>

        {/* Habilidades */}
        <Section title="Habilidades">
          <TagInput values={form.skills} onChange={val => setField('skills', val)} />
        </Section>

        {/* Projetos */}
        <Section title="Projetos">
          {form.projects.map((pr, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10, position: 'relative' }}>
              {form.projects.length > 1 && (
                <button type="button" onClick={() => removeRow('projects', i)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Título</label>
                  <input className="form-input" value={pr.title} onChange={e => setArrayField('projects', i, 'title', e.target.value)} placeholder="Nome do projeto" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Descrição</label>
                  <textarea className="form-input" rows={2} value={pr.description} onChange={e => setArrayField('projects', i, 'description', e.target.value)} placeholder="O que o projeto faz..." style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Link (GitHub, Deploy...)</label>
                  <input className="form-input" value={pr.link} onChange={e => setArrayField('projects', i, 'link', e.target.value)} placeholder="https://github.com/..." />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addRow('projects', { title: '', description: '', link: '' })}>+ Adicionar projeto</button>
        </Section>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar Currículo'}
          </button>
        </div>
      </div>
    </div>
  );
}
