// Import necessary modules
const express = require('express');
const path = require('path');
const cors = require('cors'); // Import CORS middleware
const db = require('./db'); // Import database functions

// Create an Express application instance
const app = express();

// Define the port the server will listen on.
const port = process.env.PORT || 3000;

// --- Middleware ---
// Enable CORS for all origins (adjust in production if needed)
app.use(cors());
// Enable Express to parse JSON request bodies
app.use(express.json());
// Serve static files (like the main HTML) from the current directory
// This will automatically serve index.html from the root path '/'
app.use(express.static(__dirname));

// --- API Endpoints ---

// GET /api/questions - Fetch all questions
app.get('/api/questions', async (req, res) => {
  try {
    const questionsWithComments = await db.getAllQuestions();
    res.json(questionsWithComments);
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/questions - Add a new question
app.post('/api/questions', async (req, res) => {
  // Get the question text from the request body
  const { text } = req.body;

  // Basic validation
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Question text is required.' });
  }

  try {
    const newQuestion = await db.createQuestion(text);
    // Add empty comments array for frontend compatibility
    res.status(201).json({
      ...newQuestion,
      comments: []
    });
  } catch (err) {
    console.error('Error adding question:', err);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// POST /api/questions/:id/vote - Increment vote count for a question
app.post('/api/questions/:id/vote', async (req, res) => {
  // Extract question ID from URL parameters
  const questionId = parseInt(req.params.id, 10);

  // Validate ID
  if (isNaN(questionId)) {
    return res.status(400).json({ error: 'Invalid question ID.' });
  }

  try {
    const updatedQuestion = await db.voteQuestion(questionId);
    
    // Check if a row was actually updated (i.e., the question ID exists)
    if (!updatedQuestion) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    // Send success response
    res.status(200).json({ message: 'Vote recorded successfully.', votes: updatedQuestion.votes });
  } catch (err) {
    console.error(`Error voting on question ${questionId}:`, err);
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// POST /api/questions/:id/comments - Add a comment to a specific question
app.post('/api/questions/:id/comments', async (req, res) => {
    // Extract question ID from URL parameters
    const questionId = parseInt(req.params.id, 10);
    // Extract comment text from request body
    const { text } = req.body;

    // Validate question ID
    if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID.' });
    }
    // Validate comment text
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Comment text is required.' });
    }

    try {
        const newComment = await db.addCommentToQuestion(questionId, text);
        res.status(201).json(newComment);
    } catch (err) {
        console.error(`Error adding comment to question ${questionId}:`, err);
        // Check if the error is due to foreign key violation (question_id doesn't exist)
        if (err.code === '23503') { // PostgreSQL foreign key violation error code
             return res.status(404).json({ error: 'Question not found.' });
        }
        // Handle other potential errors
        res.status(500).json({ error: 'Failed to add comment.' });
    }
});

// PATCH /api/questions/:id/answer - Toggle is_answered status for a question
app.patch('/api/questions/:id/answer', async (req, res) => {
  // Extract question ID from URL parameters
  const questionId = parseInt(req.params.id, 10);
  // Extract the new answered status from the request body
  const { is_answered } = req.body;

  // Validate question ID
  if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID.' });
  }
  // Validate is_answered status (must be a boolean)
  if (typeof is_answered !== 'boolean') {
      return res.status(400).json({ error: 'Invalid value for is_answered. It must be true or false.' });
  }

  try {
      const updatedQuestion = await db.updateQuestionAnsweredStatus(questionId, is_answered);

      // Check if a row was actually updated
      if (!updatedQuestion) {
          return res.status(404).json({ error: 'Question not found.' });
      }

      // Send success response
      res.status(200).json({ message: 'Answer status updated successfully.', is_answered: updatedQuestion.is_answered });
  } catch (err) {
      console.error(`Error updating answer status for question ${questionId}:`, err);
      res.status(500).json({ error: 'Failed to update answer status.' });
  }
});

// Poll endpoints
app.get('/api/polls', async (req, res) => {
  try {
    const polls = await db.getAllPolls();
    res.json(polls);
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

app.post('/api/polls', async (req, res) => {
  try {
    const { question, options, poll_type } = req.body;
    if (!question || !options || !poll_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const poll = await db.createPoll(question, options, poll_type);
    res.status(201).json(poll);
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

app.patch('/api/polls/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const poll = await db.updatePollStatus(id, status);
    res.json(poll);
  } catch (error) {
    console.error('Error updating poll status:', error);
    res.status(500).json({ error: 'Failed to update poll status' });
  }
});

app.post('/api/polls/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, selectedOptionIndex } = req.body;
    if (userId === undefined || selectedOptionIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const vote = await db.submitPollVote(id, userId, selectedOptionIndex);
    res.status(201).json(vote);
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

app.post('/api/polls/:id/open-answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, answerText } = req.body;
    if (!userId || !answerText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const answer = await db.submitOpenAnswer(id, userId, answerText);
    res.status(201).json(answer);
  } catch (error) {
    console.error('Error submitting open answer:', error);
    res.status(500).json({ error: 'Failed to submit open answer' });
  }
});

app.get('/api/polls/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const poll = await db.getPollById(id);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    let results;
    if (poll.poll_type === 'open_answer') {
      results = await db.getOpenAnswers(id);
    } else {
      results = await db.getPollVotes(id);
    }

    res.json({
      poll,
      results
    });
  } catch (error) {
    console.error('Error fetching poll results:', error);
    res.status(500).json({ error: 'Failed to fetch poll results' });
  }
});

// --- Serve Frontend ---
// Catch-all route to serve the main HTML file for any other GET request
// that wasn't handled by express.static or the API routes.
// This supports client-side routing and direct navigation to specific paths.
app.get('*', (req, res) => {
  // Update the filename here to index.html
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
