import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App.jsx';
import Auth0ProviderWithConfig from './auth/auth0-provider.jsx';
import '../public/styles/main.css';

// Find the root element in index.html
const container = document.getElementById('root');

// Create a React root
const root = ReactDOM.createRoot(container);

// Render the main App component
root.render(
  <React.StrictMode>
    <Auth0ProviderWithConfig>
      <App />
    </Auth0ProviderWithConfig>
  </React.StrictMode>
);
