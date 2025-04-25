import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ToolList from './ToolList.jsx';
import RaiseHandTool from './RaiseHandTool.jsx';
import PollTool from './PollTool.jsx';
import LoginButton from './LoginButton.jsx';

export default function App() {
  const [currentTool, setCurrentTool] = useState(null);
  const { isAuthenticated, isLoading, user, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Check speaker status when user authenticates
  useEffect(() => {
    async function checkSpeakerStatus() {
      if (isAuthenticated && user) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: 'https://api.classbuzz.com',
              scope: 'read:profile'
            }
          });
          
          const response = await fetch('/api/user/speaker', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          setIsSpeaker(data.isSpeaker);
        } catch (error) {
          console.error('Error checking speaker status:', error);
          setIsSpeaker(false); // Default to false on error
        }
      }
    }
    
    checkSpeakerStatus();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  const handleSelectTool = (toolId) => {
    if (toolId === 'raise-hand' || toolId === 'poll') {
      setCurrentTool(toolId);
    } else {
      console.warn(`Tool "${toolId}" is not yet implemented.`);
      alert(`Tool "${toolId}" is not yet implemented.`);
    }
  };

  const handleGoBack = () => {
    setCurrentTool(null);
  };

  // Auth0 loading state
  if (isLoading) {
    return <div className="message-box loading">Loading authentication...</div>;
  }

  // App content based on selected tool
  const renderContent = () => {
    if (currentTool === 'raise-hand') {
      return <RaiseHandTool onGoBack={handleGoBack} userIsSpeaker={isSpeaker} />;
    }

    if (currentTool === 'poll') {
      return <PollTool onGoBack={handleGoBack} userIsSpeaker={isSpeaker} />;
    }

    return <ToolList onSelectTool={handleSelectTool} userIsSpeaker={isSpeaker} />;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ClassBuzz Tools</h1>
        <LoginButton />
      </header>

      <div className="app-content">
        {isAuthenticated && (
          <div className="user-status-banner">
            Logged in as: {user.name} {isSpeaker ? '(Speaker)' : '(Guest)'}
          </div>
        )}

        {!isAuthenticated && (
          <div className="guest-banner">
            You are viewing as a guest. <button className="login-link" onClick={() => loginWithRedirect()}>Log in</button> for additional features.
          </div>
        )}

        {renderContent()}
      </div>
    </div>
  );
} 