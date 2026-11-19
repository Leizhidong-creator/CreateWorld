import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './demo/runtime.css';
import { WorldAtlas } from './site/WorldAtlas.js';
import { Portal } from './site/Portal.js';

createRoot(document.getElementById('root')!).render(<StrictMode><WorldAtlas /><Portal /></StrictMode>);
