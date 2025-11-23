import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// ดักจับ Error ไม่ให้จอขาวเงียบ
window.addEventListener('error', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.backgroundColor = '#fee2e2';
  errorDiv.style.color = '#dc2626';
  errorDiv.style.padding = '20px';
  errorDiv.style.zIndex = '9999';
  errorDiv.innerHTML = `<strong>System Error:</strong> ${event.message}`;
  document.body.appendChild(errorDiv);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)