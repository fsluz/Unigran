import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Check, X, MoreVertical } from 'lucide-react';
import './AttendanceTeacher.css';

export default function AttendanceTeacher({ courseId, onClose }) {
  const { token } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [topic, setTopic] = useState('');
  const [entries, setEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [justifications, setJustifications] = useState({});

  // Load students for this course on mount
  // This would typically fetch from the course's student roster
  // For now, we'll allow manual entry or load from AVA state
  
  const toggleStudentStatus = (studentId) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.studentId === studentId);
      if (idx >= 0) {
        const updated = [...prev];
        const current = updated[idx].status;
        updated[idx].status = current === 'present' ? 'absent' : 'present';
        return updated;
      }
      return [...prev, { studentId, status: 'present', justification: '' }];
    });
  };

  const markAbsent = (studentId) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.studentId === studentId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].status = 'absent';
        return updated;
      }
      return [...prev, { studentId, status: 'absent', justification: '' }];
    });
  };

  const markJustified = (studentId) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.studentId === studentId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].status = 'justified';
        return updated;
      }
      return [...prev, { studentId, status: 'justified', justification: '' }];
    });
  };

  const handleSave = async () => {
    if (!date.trim()) {
      showToast('Selecione a data', '!');
      return;
    }
    if (!topic.trim()) {
      showToast('Informe o topico/assunto', '!');
      return;
    }
    if (entries.length === 0) {
      showToast('Registre presenca de ao menos um aluno', '!');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date,
        topic: topic.trim(),
        entries: entries.map(e => ({
          studentId: e.studentId,
          status: e.status,
          justification: e.justification?.trim() || '',
        })),
      };

      // Call the backend API to save attendance
      const response = await fetch('/platform/v1/ava/teacher/attendance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Erro ao salvar presenca');
      }

      showToast(`Presenca registrada: ${entries.length} alunos`, 'OK');
      // Clear form
      setDate(new Date().toISOString().split('T')[0]);
      setTopic('');
      setEntries([]);
      setJustifications({});
    } catch (err) {
      showToast(err.message || 'Erro ao salvar', '!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="attendance-teacher-modal"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="attendance-overlay" onClick={onClose} />
      
      <motion.div 
        className="attendance-content"
        initial={{ y: -20 }}
        animate={{ y: 0 }}
      >
        <header className="attendance-header">
          <h2>Registrar Presenca</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="attendance-form">
          <div className="form-group">
            <label>Data</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label>Topico / Assunto da Aula</label>
            <input 
              type="text" 
              placeholder="Ex: Introducao a POO"
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
          </div>

          <div className="students-list">
            <h3>Alunos</h3>
            {entries.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum aluno adicionado ainda</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    const id = `student-${Date.now()}`;
                    setEntries([...entries, { studentId: id, status: 'present', justification: '' }]);
                  }}
                >
                  + Adicionar Aluno
                </button>
              </div>
            ) : (
              <div className="attendance-entries">
                {entries.map(entry => (
                  <div key={entry.studentId} className={`entry ${entry.status}`}>
                    <div className="entry-info">
                      <input 
                        type="text" 
                        placeholder="Matricula/Username"
                        value={entry.studentId}
                        onChange={e => {
                          setEntries(prev => prev.map(x => 
                            x === entry ? { ...x, studentId: e.target.value } : x
                          ));
                        }}
                      />
                    </div>

                    <div className="entry-status">
                      <button 
                        className={`status-btn present ${entry.status === 'present' ? 'active' : ''}`}
                        onClick={() => toggleStudentStatus(entry.studentId)}
                        title="Presente"
                      >
                        <Check size={16} />
                      </button>
                      <button 
                        className={`status-btn absent ${entry.status === 'absent' ? 'active' : ''}`}
                        onClick={() => markAbsent(entry.studentId)}
                        title="Ausente"
                      >
                        <X size={16} />
                      </button>
                      <button 
                        className={`status-btn justified ${entry.status === 'justified' ? 'active' : ''}`}
                        onClick={() => markJustified(entry.studentId)}
                        title="Justificado"
                      >
                        ?
                      </button>
                    </div>

                    {entry.status === 'justified' && (
                      <input 
                        type="text"
                        placeholder="Motivo da falta"
                        className="justification-input"
                        value={entry.justification}
                        onChange={e => {
                          setEntries(prev => prev.map(x => 
                            x === entry ? { ...x, justification: e.target.value } : x
                          ));
                        }}
                      />
                    )}

                    <button 
                      className="remove-btn"
                      onClick={() => setEntries(prev => prev.filter(x => x !== entry))}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                ))}

                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    const id = `student-${Date.now()}`;
                    setEntries([...entries, { studentId: id, status: 'present', justification: '' }]);
                  }}
                >
                  + Adicionar Aluno
                </button>
              </div>
            )}
          </div>
        </div>

        <footer className="attendance-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Registrar Presenca'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
