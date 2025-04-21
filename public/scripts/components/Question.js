import React, { useState } from 'react';
import classNames from '../utils/classNames.js';
import Comment from './Comment.js';

export default function Question({ question, onVote, onAddComment, onToggleAnswer, isSpeaker }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState(null);

  const comments = question.comments || [];

  const handleAddCommentSubmit = async (e) => {
    e.preventDefault();
    const trimmedComment = newComment.trim();
    if (!trimmedComment) return;

    setCommentError(null); // Clear previous errors
    try {
      // Call the async function passed down from RaiseHandTool
      await onAddComment(question.id, trimmedComment);
      setNewComment(''); // Clear input on success
      setShowComments(true); // Keep comments open
    } catch (error) {
      console.error("Failed to add comment:", error);
      setCommentError(error.message || "Failed to post comment. Please try again.");
    }
  };

  return (
    <div className={classNames(
      "border rounded-lg p-4 mb-4 shadow-sm transition-colors duration-200",
      question.is_answered ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow min-w-0">
          <p className={classNames(
            "text-gray-800 break-words",
            question.is_answered ? 'line-through text-gray-500' : ''
          )}>
            {question.text}
          </p>
          <div className="text-sm text-gray-500 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {/* Vote Button */}
            <button
              onClick={() => onVote(question.id)}
              disabled={question.is_answered}
              className={classNames(
                "flex items-center px-2 py-1 rounded transition-colors duration-150",
                question.is_answered ? "text-gray-400 cursor-not-allowed" : "text-blue-600 hover:bg-blue-100 disabled:opacity-50"
              )}
              aria-label={`Vote for question: ${question.text}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
              <span>{question.votes} Vote{question.votes !== 1 ? 's' : ''}</span>
            </button>
            {/* Comment Toggle Button */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center text-gray-600 hover:text-indigo-600 text-sm"
              aria-expanded={showComments}
              aria-controls={`comments-${question.id}`}
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
               {comments.length} Comment{comments.length !== 1 ? 's' : ''}
            </button>
             {/* Answered Status Badge */}
             {question.is_answered && (
                <span className="text-green-600 font-medium text-xs inline-flex items-center bg-green-100 px-2 py-0.5 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Answered
                </span>
              )}
          </div>
        </div>
        {/* Speaker Action Button */}
        {isSpeaker && (
          <button
            onClick={() => onToggleAnswer(question.id, !question.is_answered)}
            className={classNames(
              "flex-shrink-0 text-sm font-medium px-3 py-1 rounded transition-colors duration-150 self-start",
              question.is_answered ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
            )}
          >
            {question.is_answered ? 'Mark Unanswered' : 'Mark Answered'}
          </button>
        )}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div id={`comments-${question.id}`} className="mt-3 pl-4 border-l-2 border-gray-200">
          {comments.length > 0 ? (
            comments.map(comment => <Comment key={comment.id} comment={comment} />)
          ) : (
            <p className="text-sm text-gray-500 italic">No comments yet.</p>
          )}
          <form onSubmit={handleAddCommentSubmit} className="mt-3 flex items-center">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-grow border border-gray-300 rounded-l px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Add a comment to this question"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-r text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50"
              disabled={!newComment.trim()}
            >
              Add
            </button>
          </form>
          {commentError && <p className="error-inline">{commentError}</p>}
        </div>
      )}
    </div>
  );
} 