import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { pollApi } from '../api/pollApi.js';
import classNames from '../utils/classNames.js';
import PollEditor from './PollEditor.js';
import PollResults from './PollResults.js'; // Assuming PollResults is in the same directory

export default function PollTool({ onGoBack }) {
    const [polls, setPolls] = useState([]);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [submittedAnswers, setSubmittedAnswers] = useState({});
    const [editingPollId, setEditingPollId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [pollResults, setPollResults] = useState({});

    // For audience navigation
    const [currentAudiencePollIndex, setCurrentAudiencePollIndex] = useState(0);

    // Filter polls for audience view (Active or Ended only)
    const visibleAudiencePolls = useMemo(() => 
      polls.filter(p => p.poll_status === 'active' || p.poll_status === 'ended'), 
      [polls]
    );

    // Get the specific poll the audience is currently viewing
    const currentAudiencePoll = visibleAudiencePolls[currentAudiencePollIndex];

    // Check submission status for current poll
    const hasSubmittedCurrentPoll = currentAudiencePoll ? submittedAnswers[currentAudiencePoll.id] : false;

    // Reset audience selection when viewed poll changes
     useEffect(() => {
      // Ensure index is valid when the list of visible polls changes
        const newIndex = Math.min(currentAudiencePollIndex, Math.max(0, visibleAudiencePolls.length - 1));
      if (newIndex !== currentAudiencePollIndex && visibleAudiencePolls.length > 0) {
          // Only update index if it's actually out of bounds AND there are visible polls
            setCurrentAudiencePollIndex(newIndex);
      } else if (visibleAudiencePolls.length === 0 && currentAudiencePollIndex !== 0) {
          // Reset index if the list becomes empty
          setCurrentAudiencePollIndex(0);
      }
      
      // Reset selection for the new poll
      setSelectedOption(null);
    }, [currentAudiencePollIndex, visibleAudiencePolls]);

    // Fetch polls from the API
    const fetchPolls = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await pollApi.getAllPolls();
        setPolls(data);
      } catch (e) {
        console.error("Failed to fetch polls:", e);
        setError("Failed to load polls. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchPolls();
    }, [fetchPolls]);

    // Fetch poll results when needed
    useEffect(() => {
      if (currentAudiencePoll && currentAudiencePoll.poll_status === 'ended' && !pollResults[currentAudiencePoll.id]) {
        fetchPollResults(currentAudiencePoll.id);
      }
      // Dependency on currentAudiencePoll itself ensures this runs when the viewed poll changes.
      // Also depends on pollResults state to avoid refetching.
    }, [currentAudiencePoll, pollResults]); 
    
    // Function to fetch poll results
    const fetchPollResults = async (pollId) => {
      try {
        const data = await pollApi.getPollResults(pollId);
        setPollResults(prev => ({
          ...prev,
          [pollId]: data
        }));
      } catch (e) {
        console.error(`Failed to fetch results for poll ${pollId}:`, e);
        // Optionally set an error state specific to results fetching
      }
    };

    // Function to handle edit poll button click
    const handleEditPoll = (poll) => {
      setEditingPollId(poll.id);
    };

    // Handle creating or updating a poll
    const handleSavePoll = async (pollData) => {
        // No state setting here, pass the error up
        const isEditing = !!pollData.id;
      
        // Client-side validation (moved from PollEditor for consistency)
        if (!pollData.question && !pollData.imageDataUrl && !pollData.existingImageUrl) {
          throw new Error('Either question or image must be provided');
        }
        if (pollData.pollType !== 'open_ended') {
          if (!pollData.options || !Array.isArray(pollData.options)) {
            throw new Error('Options must be an array for non-open-ended polls');
          }
          const validOptions = pollData.options.filter(opt => typeof opt === 'string' && opt.trim() !== '');
          if (validOptions.length < 2) {
            throw new Error('At least two non-empty options are required');
          }
          if (new Set(validOptions).size !== validOptions.length) {
            throw new Error('Duplicate options are not allowed');
          }
          // Ensure final options are just the trimmed valid ones
          pollData.options = validOptions;
        } else {
          pollData.options = []; // Ensure empty for open-ended
        }
      
        // Prepare request body (ensure question is string, options is array)
        const requestBody = {
          question: pollData.question || "", 
          options: pollData.options || [],
          poll_type: pollData.pollType
        };
      
        if (pollData.imageDataUrl) {
          requestBody.imageDataUrl = pollData.imageDataUrl;
        } else if (pollData.existingImageUrl) {
          requestBody.existingImageUrl = pollData.existingImageUrl;
        }
      
        let responseData;
        if (isEditing) {
          responseData = await pollApi.updatePoll(pollData.id, requestBody);
        } else {
          responseData = await pollApi.createPoll(requestBody);
        }
      
        // Success: Refetch polls to update the list & close editor
        await fetchPolls(); 
        setEditingPollId(null); 
        // Don't reset form here, PollEditor handles its own reset on success (if !poll)
    };

    // Handle updating poll status
    const handleTogglePollStatus = async (pollId) => {
      try {
        const currentPoll = polls.find(p => p.id === pollId);
        if (!currentPoll) return;

        const nextStatusMap = {
          idle: 'active',
          active: 'ended',
          ended: 'idle' 
        };
        const newStatus = nextStatusMap[currentPoll.poll_status] || 'idle';
        const updatedPoll = await pollApi.updatePollStatus(pollId, newStatus);
        setPolls(prevPolls => prevPolls.map(p => p.id === pollId ? updatedPoll : p));
      } catch (e) {
        console.error("Failed to update poll status:", e);
        setError("Failed to update poll status. Please try again.");
      }
    };

    // Handle selecting an option
    const handleSelectOption = (option) => {
      if (hasSubmittedCurrentPoll || !currentAudiencePoll || currentAudiencePoll.poll_status !== 'active') return;
      setSelectedOption(option);
    };
           
    const handleSubmitVote = async (pollId) => {
      if (!selectedOption && currentAudiencePoll?.poll_type !== 'open_ended') {
        alert("Please select an option first");
        return;
      }
      if (!currentAudiencePoll) return;
      
      try {
        const optionIndex = currentAudiencePoll.options.indexOf(selectedOption);
        const tempUserId = 1; 
        
        if (optionIndex === -1 && currentAudiencePoll?.poll_type !== 'open_ended') {
          throw new Error("Selected option not found in poll options");
        }
        
        await pollApi.submitVote(pollId, tempUserId, optionIndex);
        setSubmittedAnswers(prev => ({ ...prev, [pollId]: true }));
        setSelectedOption(null); // Clear selection after successful vote
        fetchPolls(); // Refetch potentially updated vote counts
      } catch (e) {
        console.error("Failed to submit vote:", e);
        setError("Failed to submit vote: " + (e.message || "Please try again."));
      }
    };

    const handleSubmitOpenAnswer = async (pollId, answerText) => {
      if (!answerText) {
        alert("Please enter an answer");
        return;
      }
      
      try {
        const tempUserId = 1; // TODO: Replace with real user authentication
        await pollApi.submitOpenAnswer(pollId, tempUserId, answerText);
        setSubmittedAnswers(prev => ({ ...prev, [pollId]: true }));
        setSelectedOption(null); // Clear the text area value via state
        fetchPolls(); // Refetch potentially updated answers
      } catch (e) {
        console.error("Failed to submit answer:", e);
        setError("Failed to submit answer: " + (e.message || "Please try again."));
      }
    };

    const handleDeletePoll = async (pollId) => {
      if (!confirm("Are you sure you want to delete this poll? This action cannot be undone.")) {
        return;
      }
      
      try {
        await pollApi.deletePoll(pollId);
        setPolls(prevPolls => prevPolls.filter(p => p.id !== pollId));
        // Also remove results if cached
        setPollResults(prev => {
            const newResults = {...prev};
            delete newResults[pollId];
            return newResults;
        });
        // Adjust audience index if needed
        if (!isSpeaker && visibleAudiencePolls.length > 1) {
            setCurrentAudiencePollIndex(prev => Math.min(prev, visibleAudiencePolls.length - 2));
        } else if (!isSpeaker) {
             setCurrentAudiencePollIndex(0);
        }
      } catch (e) {
        console.error("Failed to delete poll:", e);
        setError("Failed to delete poll: " + (e.message || "Please try again."));
      }
    };

    // Audience Navigation Handlers
    const handleAudienceNextPoll = () => {
        if (currentAudiencePollIndex < visibleAudiencePolls.length - 1) {
          setCurrentAudiencePollIndex(prev => prev + 1);
        }
    };
    
    const handleAudiencePrevPoll = () => {
        if (currentAudiencePollIndex > 0) {
          setCurrentAudiencePollIndex(prev => prev - 1);
      }
    };

    // --- Render Logic ---
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans relative">
            <button onClick={onGoBack} className="absolute top-4 left-4 z-10 bg-white text-indigo-600 px-3 py-1 rounded-md shadow text-sm font-medium hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label="Go back to tool list">
                &larr; Back to Tools
            </button>

            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md mt-12 sm:mt-16">
                {/* Header & Speaker Toggle */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-200 gap-4">
                    <h2 className="text-2xl font-semibold text-gray-800 flex-shrink-0">Poll Tool</h2>
                    <label className="flex items-center cursor-pointer flex-shrink-0">
                        <span className="mr-2 text-sm font-medium text-gray-700">Speaker Mode:</span>
                        <div className="relative">
                            <input type="checkbox" className="sr-only peer" checked={isSpeaker} onChange={() => { 
                                setIsSpeaker(!isSpeaker); 
                                setEditingPollId(null); // Close editor if switching modes
                                setCurrentAudiencePollIndex(0); // Reset index when switching modes
                                setError(null); // Clear errors when switching
                            }} id="poll-speaker-toggle" />
                            <div className="w-10 h-6 rounded-full transition bg-gray-300 peer-checked:bg-indigo-600"></div>
                            <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-4 dot"></div>
                        </div>
                    </label>
                </div>

                {/* Loading and Error States */} 
                {isLoading ? (
                  <div className="message-box loading">
                    <p>Loading polls...</p>
                  </div>
                ) : error ? (
                  <div className="message-box error">
                    <p>{error}</p>
                    <button 
                      onClick={() => { setError(null); fetchPolls(); }}
                      className="mt-2 bg-red-100 text-red-800 px-4 py-2 rounded hover:bg-red-200"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  /* Main Content */
                  isSpeaker ? (
                    // --- Speaker View ---
                    <div>
                        {editingPollId !== null ? (
                            <PollEditor 
                                key={editingPollId || 'new'} // Force re-render when editing different polls or creating new
                                poll={editingPollId === 'new' ? null : polls.find(p => p.id === editingPollId)} 
                                onSave={async (pollData) => {
                                  // Wrap save logic to handle potential errors from handleSavePoll
                                  try {
                                    setIsLoading(true); // Show loading in parent during save
                                    setError(null);
                                    await handleSavePoll(pollData);
                                    // Success is handled within handleSavePoll (refetch, close editor)
                                  } catch (e) {
                                    console.error("Error saving poll:", e);
                                    setError(e.message || 'An unexpected error occurred while saving.');
                                    // Keep editor open on error
                                  } finally {
                                    setIsLoading(false);
                                  }
                                }}
                                onCancel={() => { setEditingPollId(null); setError(null); }} 
                            />
                        ) : (
                            // Show Poll List and Create Button when not editing
                            <div>
                                  <button onClick={() => setEditingPollId('new')} className="w-full mb-6 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150" > + Create New Poll </button>
                                <h3 className="text-lg font-medium text-gray-700 mb-3">Manage Polls</h3>
                                {polls.length === 0 ? ( <p className="text-center text-gray-500 py-4">No polls created yet.</p> ) : (
                                    <div className="space-y-3">
                                        {polls.map(poll => (
                                            <div key={poll.id} className="poll-list-item">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-gray-800 font-medium truncate" title={poll.question || 'Poll Image'}>{poll.question || 'Poll Image'}</p>
                                                      <span className={classNames( 
                                                          'status-badge', 
                                                          poll.poll_status === 'idle' && 'status-idle', 
                                                          poll.poll_status === 'active' && 'status-active', 
                                                          poll.poll_status === 'ended' && 'status-ended'
                                                      )}>
                                                          {poll.poll_status || 'idle'}
                                                      </span>
                                                      {poll.poll_status !== 'idle' && <p className="text-xs text-gray-500 mt-1">{poll.total_votes || 0} vote(s)</p>}
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                                                      <button 
                                                          onClick={() => handleEditPoll(poll)} 
                                                          disabled={poll.poll_status === 'active'} 
                                                          className="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                      >
                                                          Edit
                                                      </button>
                                                      <button 
                                                          onClick={() => handleTogglePollStatus(poll.id)} 
                                                          className={classNames(
                                                              "text-sm text-white px-3 py-1 rounded-md transition-colors",
                                                              poll.poll_status === 'active' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600',
                                                              poll.poll_status === 'ended' && 'bg-gray-400 hover:bg-gray-500' // Resume button style
                                                          )}
                                                      >
                                                          {poll.poll_status === 'active' ? 'End Poll' : poll.poll_status === 'ended' ? 'Set Idle' : 'Start Poll'}
                                                      </button>
                                                      <button 
                                                          onClick={() => handleDeletePoll(poll.id)}
                                                          className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition-colors"
                                                      >
                                                          Delete
                                                      </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                      // --- Audience View ---
                      visibleAudiencePolls.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">No polls are currently available to view.</p>
                    ) : (
                        <div>
                              {/* Audience Poll Navigation */} 
                            <div className="flex justify-between items-center mb-4">
                                <button
                                    onClick={handleAudiencePrevPoll}
                                    disabled={currentAudiencePollIndex === 0}
                                    className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    &larr; Previous
                                </button>
                                  <span className="text-sm text-gray-500">
                                      Poll {currentAudiencePollIndex + 1} of {visibleAudiencePolls.length}
                                  </span>
                                <button
                                    onClick={handleAudienceNextPoll}
                                    disabled={currentAudiencePollIndex === visibleAudiencePolls.length - 1}
                                    className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next &rarr;
                                </button>
                            </div>

                              {/* Display Current Audience Poll */} 
                              {currentAudiencePoll && (
                                <div key={currentAudiencePoll.id}> {/* Add key here for re-render on poll change */} 
                                    <h3 className="text-xl font-semibold text-gray-800 mb-5 text-center break-words">{currentAudiencePoll.question || 'Poll Image'}</h3>

                                      {currentAudiencePoll.image_url && (
                                          <div className="mb-6 flex justify-center">
                                              <img 
                                                  src={currentAudiencePoll.image_url} 
                                                  alt="Poll image" 
                                                  className="max-w-full h-auto rounded-lg shadow-md max-h-300px"
                                              />
                                          </div>
                                      )}
                                      
                                      {currentAudiencePoll.poll_type === 'open_ended' ? (
                                          <div className="mb-6">
                                              <textarea 
                                                  value={selectedOption || ''} // Use selectedOption state for controlled input
                                                  onChange={(e) => setSelectedOption(e.target.value)}
                                                  disabled={hasSubmittedCurrentPoll || currentAudiencePoll.poll_status !== 'active'}
                                                  placeholder="Type your answer here..."
                                                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                                                  rows={4}
                                              />
                                              
                                              {currentAudiencePoll.poll_status === 'active' && !hasSubmittedCurrentPoll && (
                                                  <button
                                                      onClick={() => handleSubmitOpenAnswer(currentAudiencePoll.id, selectedOption)}
                                                      disabled={!selectedOption}
                                                      className="w-full mt-4 bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                                  >
                                                      Submit Answer
                                                  </button>
                                              )}
                                          </div>
                                      ) : (
                                          <div className="space-y-3 mb-6">
                                                {currentAudiencePoll.options.map((option, index) => (
                                            <div
                                                key={index}
                                                onClick={() => handleSelectOption(option)}
                                                className={classNames(
                                                    'poll-option',
                                                      selectedOption === option && !hasSubmittedCurrentPoll && currentAudiencePoll.poll_status === 'active' && 'selected',
                                                      (hasSubmittedCurrentPoll || currentAudiencePoll.poll_status !== 'active') && 'disabled submitted'
                                                )}
                                            >
                                                {option}
                                            </div>
                                        ))}

                                              {currentAudiencePoll.poll_status === 'active' && !hasSubmittedCurrentPoll && (
                                        <button
                                          onClick={() => handleSubmitVote(currentAudiencePoll.id)}
                                          disabled={!selectedOption}
                                          className="w-full mt-4 bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Submit Vote
                                        </button>
                                    )}
                                          </div>
                                      )}
                                      
                                    {hasSubmittedCurrentPoll && (
                                      <p className="text-center text-green-700 font-medium bg-green-100 p-3 rounded-md">Your answer for this poll has been submitted!</p>
                                  )}
                                    
                                    {currentAudiencePoll.poll_status === 'ended' && !hasSubmittedCurrentPoll && (
                                       <p className="text-center text-red-700 font-medium bg-red-100 p-3 rounded-md">This poll has ended.</p>
                                  )}

                                    {/* Results (Show only if poll status is 'ended') */} 
                                    {currentAudiencePoll.poll_status === 'ended' && (
                                        <div className="mt-6 border-t pt-4 border-gray-200">
                                            <h4 className="text-lg font-medium text-gray-800 mb-3">Poll Results</h4>
                                            {currentAudiencePoll.poll_type === 'open_ended' ? (
                                                <div className="space-y-2">
                                                    <p className="text-center text-gray-500">
                                                        {pollResults[currentAudiencePoll.id]?.results?.length > 0 ? 'Open answer responses:' : 'No open answer responses submitted.'}
                                                    </p>
                                                    {pollResults[currentAudiencePoll.id]?.results?.length > 0 && (
                                                        <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded-md border">
                                                            {pollResults[currentAudiencePoll.id].results.map((answer, index) => (
                                                                <div key={index} className="bg-white p-2 rounded shadow-sm">
                                                                    <p className="text-gray-800 break-words">{answer.answer_text}</p>
                                                                    {/* <p className="text-xs text-gray-500 mt-1">User ID: {answer.user_id}</p> */} {/* Hide User ID */} 
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                // Use PollResults component for bar charts
                                                <PollResults
                                                    options={currentAudiencePoll.options}
                                                    results={ // Calculate results in the format PollResults expects
                                                        (pollResults[currentAudiencePoll.id]?.results || []).reduce((acc, vote) => {
                                                            const optionIndex = parseInt(vote.selected_option_index);
                                                            if (optionIndex >= 0 && optionIndex < currentAudiencePoll.options.length) {
                                                                const optionText = currentAudiencePoll.options[optionIndex];
                                                                acc[optionText] = (acc[optionText] || 0) + 1;
                                                            }
                                                            return acc;
                                                        }, {})
                                                    }
                                                    totalVotes={pollResults[currentAudiencePoll.id]?.results?.length || 0}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                              )}
                        </div>
                      )
                    )
                )}
            </div>
        </div>
    );
} 