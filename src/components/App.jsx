import React, { useState } from 'react';
import ToolList from './ToolList.jsx';
import RaiseHandTool from './RaiseHandTool.jsx';
import PollTool from './PollTool.jsx';

export default function App() {
  const [currentTool, setCurrentTool] = useState(null);

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

  if (currentTool === 'raise-hand') {
    return <RaiseHandTool onGoBack={handleGoBack} />;
  }

  if (currentTool === 'poll') {
    return <PollTool onGoBack={handleGoBack} />;
  }

  return <ToolList onSelectTool={handleSelectTool} />;
} 