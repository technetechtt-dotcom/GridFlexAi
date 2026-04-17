import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
const container = document.getElementById('root') as HTMLElement;
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
