const React = window.React;
const { useState, useEffect, useCallback, useMemo } = React;
import { questionApi } from '../api/questionApi.js';
import Question from './Question.js';

export default function RaiseHandTool({ onGoBack }) {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSpeaker, setIsSpeaker] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await questionApi.getAllQuestions();
      // Converts created_at string from the database into a Date object, which is easier to work with in the UI.
      const questionsWithDates = data.map(q => ({
          ...q,
          createdAt: new Date(q.created_at),
          comments: (q.comments || []).map(c => ({ ...c, createdAt: new Date(c.created_at) }))
      }));
      setQuestions(questionsWithDates);
    } catch (e) {
      console.error("Failed to fetch questions:", e);
      setError("Failed to load questions. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // --- Add Question ---
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    const trimmedQuestion = newQuestion.trim();
    if (!trimmedQuestion) return;
    setNewQuestion('');

    try {
      const addedQuestion = await questionApi.createQuestion({ text: trimmedQuestion });
      const newQ = {
          ...addedQuestion,
          createdAt: new Date(addedQuestion.created_at),
          comments: (addedQuestion.comments || []).map(c => ({ ...c, createdAt: new Date(c.created_at) }))
      };
      setQuestions(prevQuestions => [newQ, ...prevQuestions]);
    } catch (e) {
      console.error("Failed to add question:", e);
      setError(`Failed to add question: ${e.message}. Please try again.`);
      setNewQuestion(trimmedQuestion);
    }
  };

  // --- Vote ---
  const handleVote = useCallback(async (questionId) => {
    const originalQuestions = questions;
    setQuestions(prevQuestions =>
      prevQuestions.map(q =>
        q.id === questionId ? { ...q, votes: q.votes + 1 } : q
      )
    );

    try {
      await questionApi.voteQuestion(questionId);
    } catch (e) {
      console.error("Failed to vote:", e);
      setError(`Vote failed: ${e.message}`);
      setQuestions(originalQuestions);
    }
  }, [questions]); // Include questions to get latest state for revert

  // --- Add Comment ---
  const handleAddComment = useCallback(async (questionId, commentText) => {
    try {
      const newComment = await questionApi.addComment(questionId, { text: commentText });
      setQuestions(prevQuestions =>
        prevQuestions.map(q =>
          q.id === questionId
            ? {
                ...q,
                comments: [
                    ...(q.comments || []),
                    { ...newComment, createdAt: new Date(newComment.created_at) }
                ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              }
            : q
        )
      );
    } catch (e) {
      throw new Error(e.message || "Failed to add comment");
    }
  }, []);

  // --- Toggle Answer ---
  const handleToggleAnswer = useCallback(async (questionId, newAnsweredState) => {
    if (!isSpeaker) return;
    const originalQuestions = questions;

    setQuestions(prevQuestions =>
      prevQuestions.map(q =>
        q.id === questionId ? { ...q, is_answered: newAnsweredState } : q
      )
    );

    try {
      await questionApi.markQuestionAnswered(questionId);
    } catch (e) {
      console.error("Failed to toggle answer status:", e);
      setError(`Failed to toggle answer status: ${e.message}`);
      setQuestions(originalQuestions);
    }
  }, [isSpeaker, questions]); // Include questions for revert, isSpeaker for check

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.is_answered !== b.is_answered) { return a.is_answered ? 1 : -1; }
      if (b.votes !== a.votes) { return b.votes - a.votes; }
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return dateA - dateB;
    });
  }, [questions]);

  // --- Render UI ---
  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans relative">
       <button onClick={onGoBack} className="absolute top-4 left-4 z-10 bg-white text-indigo-600 px-3 py-1 rounded-md shadow text-sm font-medium hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" aria-label="Go back to tool list" > &larr; Back to Tools </button>
       <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md mt-12 sm:mt-16">
          {/* Header and Speaker Toggle */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-200 gap-4">
            <h2 className="text-2xl font-semibold text-gray-800 flex-shrink-0">Raise Hand / Q&A</h2>
            <label className="flex items-center cursor-pointer flex-shrink-0">
              <span className="mr-2 text-sm font-medium text-gray-700">Speaker Mode:</span>
              <div className="relative">
                <input type="checkbox" className="sr-only peer" checked={isSpeaker} onChange={() => setIsSpeaker(!isSpeaker)} id="speaker-toggle" />
                <div className="w-10 h-6 rounded-full transition bg-gray-300 peer-checked:bg-indigo-600"></div>
                <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform peer-checked:translate-x-4 dot"></div>
              </div>
            </label>
          </div>
          {/* Add Question Form */}
          <form onSubmit={handleAddQuestion} className="mb-6 flex flex-col sm:flex-row gap-2">
            <input type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Ask a question..." className="flex-grow border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" aria-label="Ask a new question" />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 disabled:opacity-50" disabled={!newQuestion.trim()} > Ask </button>
          </form>
           {/* Display Top-Level Error */}
           {error && <div className="message-box error mb-4">{error}</div>}

          {/* Display Loading / Questions List */}
          <div className="space-y-4">
             <h3 className="text-lg font-medium text-gray-700 mb-2">Questions</h3>
             {isLoading && <div className="message-box loading">Loading questions...</div>}
             {!isLoading && !error && sortedQuestions.length === 0 && (
                 <p className="text-gray-500 italic text-center py-4">No questions asked yet. Be the first!</p>
             )}
             {!isLoading && !error && sortedQuestions.length > 0 && (
                sortedQuestions.map(question => (
                  <Question
                    key={question.id}
                    question={question}
                    onVote={handleVote}
                    onAddComment={handleAddComment}
                    onToggleAnswer={handleToggleAnswer}
                    isSpeaker={isSpeaker}
                  />
                ))
             )}
          </div>
       </div>
    </div>
  );
}