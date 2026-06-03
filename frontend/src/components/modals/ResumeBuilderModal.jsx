import { useState } from 'react';
import { Briefcase, GraduationCap, Link2, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { apiFetch, authHeaders } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

const EMPTY_EDUCATION = { institution: '', course: '', period: '' };
const EMPTY_EXPERIENCE = { company: '', role: '', period: '', description: '' };
const EMPTY_PROJECT = { title: '', description: '', link: '' };

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  professionalTitle: '',
  objective: '',
  education: [{ ...EMPTY_EDUCATION }],
  experience: [{ ...EMPTY_EXPERIENCE }],
  skills: [],
  projects: [{ ...EMPTY_PROJECT }],
};

function saneText(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  const bad = (text.match(/[^\x09\x0A\x0D\x20-\x7EÀ-ɏ]/g) || []).length;
  return bad / Math.max(text.length, 1) > 0.12 ? '' : text;
}

function normalizeInitial(initial) {
  const vr = initial?.virtualResume || {};
  return {
    name: saneText(vr.name) || '',
    email: saneText(vr.email || vr.contacts?.emails?.[0]) || '',
    phone: saneText(vr.phone || vr.contacts?.phones?.[0]) || '',
    professionalTitle: saneText(vr.professionalTitle) || '',
    objective: saneText(vr.about || vr.objective || initial?.summary) || '',
    education: Array.isArray(vr.education) && vr.education.length ? vr.education : [{ ...EMPTY_EDUCATION }],
    experience: Array.isArray(vr.experience) && vr.experience.length
      ? vr.experience
      : (Array.isArray(vr.experiences) && vr.experiences.length ? vr.experiences : [{ ...EMPTY_EXPERIENCE }]),
    skills: Array.isArray(vr.hardSkills || vr.skills) ? (vr.hardSkills || vr.skills).filter(saneText) : [],
    projects: Array.isArray(vr.projects) && vr.projects.length ? vr.projects : [{ ...EMPTY_PROJECT }],
  };
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="resume-form-section">
      <div className="resume-form-section-head">
        <span className="resume-form-section-icon">{Icon ? <Icon size={16} /> : <Sparkles size={16} />}</span>
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text', rows }) {
  const Input = rows ? 'textarea' : 'input';
  return (
    <label className="resume-form-field">
      <span>{label}</span>
      <Input
        className="form-input"
        type={rows ? undefined : type}
        rows={rows}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TagInput({ values, onChange }) {
  const [input, setInput] = useState('');

  const add = () => {
    const value = input.trim();
    if (!value) return;
    onChange([...new Set([...values, value])].slice(0, 40));
    setInput('');
  };

  return (
    <div className="resume-tag-input">
      <div className="resume-tag-add">
        <input
          className="form-input"
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="React, Python, Excel, comunicação..."
        />
        <button type="button" className="btn btn-secondary" onClick={add}>
          <Plus size={15} /> Adicionar
        </button>
      </div>
      <div className="resume-tag-list">
        {values.map(tag => (
          <button key={tag} type="button" onClick={() => onChange(values.filter(item => item !== tag))}>
            {tag}
            <X size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Repeater({ items, emptyItem, onChange, children, addLabel }) {
  const update = (index, key, value) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const remove = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="resume-repeater">
      {items.map((item, index) => (
        <div key={index} className="resume-repeat-card">
          {items.length > 1 && (
            <button type="button" className="resume-repeat-remove" onClick={() => remove(index)} aria-label="Remover">
              <Trash2 size={15} />
            </button>
          )}
          {children(item, index, update)}
        </div>
      ))}
      <button type="button" className="resume-add-row" onClick={() => onChange([...items, { ...emptyItem }])}>
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

export default function ResumeBuilderModal({ initial, token, onSave, onClose }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => normalizeInitial(initial));
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Informe seu nome completo', '!');
      return;
    }
    if (!form.professionalTitle.trim() && !form.objective.trim()) {
      showToast('Preencha um título ou resumo profissional', '!');
      return;
    }

    try {
      setSaving(true);
      const res = await apiFetch('/uploads/resume/structured', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar currículo');
      showToast('Currículo salvo no portfólio', 'OK');
      onSave?.(data.resume, data.analysis);
      onClose();
    } catch (err) {
      showToast(err.message || 'Falha ao salvar currículo', '!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay resume-builder-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="resume-builder-modal" role="dialog" aria-modal="true" aria-label="Currículo do portfólio">
        <header className="resume-builder-head">
          <div>
            <span className="resume-builder-kicker"><Sparkles size={14} /> Portfólio profissional</span>
            <h2>Currículo por formulário</h2>
            <p>Preencha seus dados com calma. A vitrine usa essas informações sem tentar ler PDF ou DOCX.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="resume-builder-body">
          <Section title="Dados principais" subtitle="Esses campos aparecem no topo do currículo." icon={Sparkles}>
            <div className="resume-form-grid">
              <TextField label="Nome completo" value={form.name} onChange={value => setField('name', value)} placeholder="Seu nome completo" />
              <TextField label="Título profissional" value={form.professionalTitle} onChange={value => setField('professionalTitle', value)} placeholder="Ex: Estudante de ADS | Frontend Junior" />
              <TextField label="E-mail" type="email" value={form.email} onChange={value => setField('email', value)} placeholder="seu@email.com" />
              <TextField label="Telefone" value={form.phone} onChange={value => setField('phone', value)} placeholder="+55 67 99999-0000" />
              <div className="resume-form-wide">
                <TextField label="Resumo profissional" rows={4} value={form.objective} onChange={value => setField('objective', value)} placeholder="Fale sobre sua área, objetivo, experiências acadêmicas e tipo de oportunidade que busca." />
              </div>
            </div>
          </Section>

          <Section title="Formação acadêmica" subtitle="Cursos, faculdade e período." icon={GraduationCap}>
            <Repeater
              items={form.education}
              emptyItem={EMPTY_EDUCATION}
              onChange={value => setField('education', value)}
              addLabel="Adicionar formação"
            >
              {(item, index, update) => (
                <div className="resume-form-grid">
                  <TextField label="Instituição" value={item.institution || item.title || ''} onChange={value => update(index, 'institution', value)} placeholder="UNIGRAN" />
                  <TextField label="Curso" value={item.course || ''} onChange={value => update(index, 'course', value)} placeholder="Análise e Desenvolvimento de Sistemas" />
                  <TextField label="Período" value={item.period || item.year || item.description || ''} onChange={value => update(index, 'period', value)} placeholder="2024 - em andamento" />
                </div>
              )}
            </Repeater>
          </Section>

          <Section title="Experiências" subtitle="Pode incluir estágio, trabalho, monitoria ou projeto aplicado." icon={Briefcase}>
            <Repeater
              items={form.experience}
              emptyItem={EMPTY_EXPERIENCE}
              onChange={value => setField('experience', value)}
              addLabel="Adicionar experiência"
            >
              {(item, index, update) => (
                <div className="resume-form-grid">
                  <TextField label="Empresa ou contexto" value={item.company || item.title || ''} onChange={value => update(index, 'company', value)} placeholder="Empresa, laboratório, projeto acadêmico..." />
                  <TextField label="Cargo ou papel" value={item.role || ''} onChange={value => update(index, 'role', value)} placeholder="Estagiário, desenvolvedor, pesquisador..." />
                  <TextField label="Período" value={item.period || ''} onChange={value => update(index, 'period', value)} placeholder="Jan/2025 - atual" />
                  <div className="resume-form-wide">
                    <TextField label="Descrição" rows={3} value={item.description || ''} onChange={value => update(index, 'description', value)} placeholder="Conte responsabilidades, ferramentas usadas e resultados reais." />
                  </div>
                </div>
              )}
            </Repeater>
          </Section>

          <Section title="Habilidades" subtitle="Adicione tecnologias e competências que você quer destacar." icon={Sparkles}>
            <TagInput values={form.skills} onChange={value => setField('skills', value)} />
          </Section>

          <Section title="Projetos" subtitle="Mostre evidências: GitHub, deploy, apresentação ou artigo." icon={Link2}>
            <Repeater
              items={form.projects}
              emptyItem={EMPTY_PROJECT}
              onChange={value => setField('projects', value)}
              addLabel="Adicionar projeto"
            >
              {(item, index, update) => (
                <div className="resume-form-grid">
                  <TextField label="Título" value={item.title || ''} onChange={value => update(index, 'title', value)} placeholder="Nome do projeto" />
                  <TextField label="Link" value={item.link || ''} onChange={value => update(index, 'link', value)} placeholder="https://..." />
                  <div className="resume-form-wide">
                    <TextField label="Descrição" rows={3} value={item.description || ''} onChange={value => update(index, 'description', value)} placeholder="Problema resolvido, tecnologias e resultado." />
                  </div>
                </div>
              )}
            </Repeater>
          </Section>
        </div>

        <footer className="resume-builder-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar currículo'}
          </button>
        </footer>
      </div>
    </div>
  );
}
