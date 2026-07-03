import React from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import '@shared/styles/globals.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OverlayApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
