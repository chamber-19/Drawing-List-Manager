import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ActivationGate } from '@chamber-19/desktop-toolkit/activation'
import { ToolkitThemeProvider } from '@chamber-19/desktop-toolkit/theme'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToolkitThemeProvider storageKey="dlm.theme">
      <ActivationGate>
        <App />
      </ActivationGate>
    </ToolkitThemeProvider>
  </StrictMode>,
)