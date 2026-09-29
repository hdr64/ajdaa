import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider'
import { LanguageProvider } from './context/LanguageContext'
import { SiteSettingsProvider } from './context/SiteSettingsProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <SiteSettingsProvider>
          <App />
        </SiteSettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
