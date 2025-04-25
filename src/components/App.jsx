import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ToolList from './ToolList.jsx';
import RaiseHandTool from './RaiseHandTool.jsx';
import PollTool from './PollTool.jsx';
import LoginButton from './LoginButton.jsx';

export default function App() {
  const [currentTool, setCurrentTool] = useState(null);
  const { isAuthenticated, isLoading, user, loginWithRedirect } = useAuth0();

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

  // Determine if user is a speaker (for future use)
  const isSpeaker = isAuthenticated ? checkIfUserIsSpeaker(user) : false;

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

// Helper function to determine if a user is a speaker (placeholder for future implementation)
function checkIfUserIsSpeaker(user) {
  // This is a placeholder. In the future, you might:
  // - Check against a list of speaker email domains
  // - Verify roles in the user's Auth0 profile
  // - Make an API call to check if this user ID is registered as a speaker
  return false; // Default to false for now
} 