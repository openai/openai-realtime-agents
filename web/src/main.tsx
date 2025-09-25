import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TranscriptProvider } from '@/contexts/TranscriptContext';
import { EventProvider } from '@/contexts/EventContext';
import './globals.css';
import './styles.css';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <TranscriptProvider>
    <EventProvider>
      <App />
    </EventProvider>
  </TranscriptProvider>
);
