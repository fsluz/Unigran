import { useState } from 'react';
import { X } from 'lucide-react';
import { CONFIG, CHAT_CONFIG } from '../../config/integrations';

export default function ChatGPTMakerModal({ isOpen, onClose }) {
  const chatbotId = CONFIG.GPTMAKER_CHATBOT_ID;
  const chatbotUrl = `https://app.gptmaker.ai/chat/${chatbotId}`;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal */}
      <div
        className="chat-gptmaker-modal"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 'min(500px, 90vw)',
          height: 'min(600px, 85vh)',
          background: '#fff',
          borderRadius: 'var(--radius)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          animation: 'slideInUp 0.3s ease-out',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{CHAT_CONFIG.GPT_MAKER.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{CHAT_CONFIG.GPT_MAKER.subtitle}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat Area */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--page-bg)',
          }}
        >
          {chatbotId === 'YOUR_CHATBOT_ID' ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
                ⚙️ Configuração necessária
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300 }}>
                Para usar o atendimento GPT Maker, defina sua{' '}
                <strong>VITE_GPTMAKER_CHATBOT_ID</strong> no arquivo <code>.env</code> da pasta frontend.
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace' }}>
                VITE_GPTMAKER_CHATBOT_ID=seu_id_aqui
              </div>
            </div>
          ) : (
            <iframe
              src={chatbotUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '0 0 var(--radius) var(--radius)',
              }}
              title="Chat GPT Maker"
              allow="microphone; camera; geolocation"
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
