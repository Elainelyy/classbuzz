import React, { useState } from 'react';
import ToolList from './ToolList.js';
import RaiseHandTool from './RaiseHandTool.js';
import PollTool from './PollTool.js';

export default function App() {
  const [currentTool, setCurrentTool] = useState(null);

  const handleSelectTool = (toolId) => {
    if (toolId === 'raise-hand' || toolId === 'poll') {
      setCurrentTool(toolId);
    } else {
      alert(`Tool "${toolId}" is not yet implemented.`);
    }
  };

  const handleGoBack = () => {
    setCurrentTool(null);
  };

  if (currentTool === 'raise-hand') {
    return <RaiseHandTool onGoBack={handleGoBack} />;
  }

  if (currentTool === 'poll') {
    return <PollTool onGoBack={handleGoBack} />;
  }

  return <ToolList onSelectTool={handleSelectTool} />;
} 