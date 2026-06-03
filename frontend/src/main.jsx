import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/components.css';
import './styles/zuni-final.css';
import './styles/portal-ava-mobile.css';
import './styles/aesthetic-system.css';
import './styles/portfolio-clean.css';
import './styles/portal-refactor.css';
import './styles/meu-caminho.css';
import './styles/master-bi.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
