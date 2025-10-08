// web/src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TranscriptProvider } from '@/contexts/TranscriptContext';
import { EventProvider } from '@/contexts/EventContext';
import SDKTestStandalone from './sdkTest';
import LlmTest from './LlmTest';
import './globals.css';
import './styles.css';

const container = document.getElementById('root')!;
// Reuse existing root if Hot Module Replacement or multiple imports occur
// @ts-ignore
const existingRoot = (window as any).__APP_ROOT__ as
  | ReturnType<typeof createRoot>
  | undefined;
// @ts-ignore
const root = existingRoot || createRoot(container);
// @ts-ignore
if (!(window as any).__APP_ROOT__) (window as any).__APP_ROOT__ = root;
function Root() {
  const path = window.location.pathname;
  if (path.startsWith('/sdk-test')) {
    return <SDKTestStandalone />;
  }
  if (path.startsWith('/llm-test')) {
    return <LlmTest />;
  }
  return (
    <TranscriptProvider>
      <EventProvider>
        <App />
      </EventProvider>
    </TranscriptProvider>
  );
}

root.render(<Root />);
