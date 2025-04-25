import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

const domain = 'dev-0hou552bxbe8cst4.us.auth0.com';
const clientId = 'igVS2s5PCjEl2bcaBBEndtBh8NC1yz5R';
const audience = 'https://api.classbuzz.com';

const Auth0ProviderWithConfig = ({ children }) => {
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithConfig; 