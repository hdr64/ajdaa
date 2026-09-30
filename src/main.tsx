import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider'
import { LanguageProvider } from './context/LanguageContext'
import { SiteSettingsProvider } from './context/SiteSettingsProvider'
import { CmsProvider } from './context/CmsProvider'
import { reportClientError } from './services/api'

// Global browser error telemetry to server errors.log
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Avoid noisy browser extension or resize observer errors
    if (event.message?.includes('ResizeObserver') || event.filename?.includes('extension:')) return;
    reportClientError(`Unhandled browser error: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    reportClientError(`Unhandled Promise rejection: ${msg}`, {
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SiteSettingsProvider>
          <CmsProvider>
            <App />
          </CmsProvider>
        </SiteSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
