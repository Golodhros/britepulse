import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@britecharts/core/dist/styles/bundle/britecharts.min.css';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
