// Configuration for external integrations
export const CONFIG = {
  // GPT Maker Chat Integration
  // Get your chatbot ID from https://app.gptmaker.ai/
  // Format: https://app.gptmaker.ai/chat/YOUR_CHATBOT_ID
  GPTMAKER_CHATBOT_ID: import.meta.env.VITE_GPTMAKER_CHATBOT_ID || 'YOUR_CHATBOT_ID',

  // RAI Configuration
  RAI_ENABLED: true,
  RAI_API_ENDPOINT: '/api/platform/v1/ai/assistant',
};

// Chat configuration
export const CHAT_CONFIG = {
  GPT_MAKER: {
    name: 'Atendimento UNIGRAN',
    subtitle: 'Powered by GPT Maker',
    color: '#ff6b6b',
  },
  RAI: {
    name: 'RAi Assistente',
    subtitle: 'Suporte acadêmico 24/7',
    color: 'var(--accent)',
  },
};
