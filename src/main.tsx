import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)



// const ajdaaFestaUrl ='https://youtu.be/mYfEpM_GTuc'
// const ajdaaVeraUrl ='https://youtu.be/3RlVLmDkres'
// const ajdaaPrimeUrl ='https://youtu.be/3RlVLmDkres'
// const ajdaaAlMansoriaUrl ='https://youtu.be/Ti7MQxfmNWY'
// const ajdaaFesta2Url ='https://youtu.be/jZ6x76Uf9_Q'
// const ajdaaAlRemalUrl ='https://youtu.be/AUvKPKorzHE'
