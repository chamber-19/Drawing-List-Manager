import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ActivationGate } from '@chamber-19/desktop-toolkit/activation'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ActivationGate>
      <App />
    </ActivationGate>
  </StrictMode>,
)