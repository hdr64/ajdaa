import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { ThemeProvider } from './context/ThemeProvider'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)



// const ajdaaFestaUrl ='https://youtu.be/mYfEpM_GTuc'
// const ajdaaVeraUrl ='https://youtu.be/3RlVLmDkres'
// const ajdaaPrimeUrl ='https://youtu.be/3RlVLmDkres'
// const ajdaaAlMansoriaUrl ='https://youtu.be/Ti7MQxfmNWY'
// const ajdaaFesta2Url ='https://youtu.be/jZ6x76Uf9_Q'
// const ajdaaAlRemalUrl ='https://youtu.be/AUvKPKorzHE'
// https://ajdaa.sa/wp-content/uploads/2026/04/شعار-المنيع-1024x569.webp 1024w, https://ajdaa.sa/wp-content/uploads/2026/04/شعار-المنيع-300x167.webp 300w, https://ajdaa.sa/wp-content/uploads/2026/04/شعار-المنيع-768x427.webp 768w, https://ajdaa.sa/wp-content/uploads/2026/04/شعار-المنيع-1536x853.webp 1536w, https://ajdaa.sa/wp-content/uploads/2026/04/شعار-المنيع-2048x1138.webp 2048w
