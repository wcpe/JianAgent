import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './i18n/index.js';
import '@xterm/xterm/css/xterm.css';
import './styles/themes/theme-default.css';
import './styles/themes/theme-ocean.css';
import './styles/themes/theme-emerald.css';
import './index.css';
import './styles/base.css';
import './styles/terminal.css';
import './styles/motion.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
