// Import necessary modules
const express = require('express');
const path = require('path');
const cors = require('cors'); // Import CORS middleware
const { Pool } = require('pg'); // Import Node-postgres

// Create an Express application instance
const app = express();

// Define the port the server will listen on.
const port = process.env.PORT || 3000;

// --- Database Connection ---
// Create a connection pool using the DATABASE_URL environment variable
// Heroku automatically sets DATABASE_URL. For local development, you'll need to set it.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add SSL configuration for Heroku connections
  // (Heroku requires SSL, but disable it for local connections unless you set up local SSL)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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
    // Query the database to get all questions with their comments
    // Using LEFT JOIN to include questions even if they have no comments
    const result = await pool.query(`
      SELECT 
        q.id, 
        q.text, 
        q.votes, 
        q.is_answered, 
        q.created_at,
        json_agg(
          json_build_object(
            'id', c.id,
            'text', c.text,
            'created_at', c.created_at
          )
        ) FILTER (WHERE c.id IS NOT NULL) as comments
      FROM questions q
      LEFT JOIN comments c ON q.id = c.question_id
      GROUP BY q.id, q.text, q.votes, q.is_answered, q.created_at
      ORDER BY q.is_answered ASC, q.votes DESC, q.created_at ASC
    `);

    // Process the results to ensure comments is always an array
    const questionsWithComments = result.rows.map(q => ({
      ...q,
      comments: q.comments || [] // Ensure comments is an array even if null
    }));

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
    // Insert the new question into the database, returning the newly created row
    const result = await pool.query(
      'INSERT INTO questions (text) VALUES ($1) RETURNING id, text, votes, is_answered, created_at',
      [text.trim()] // Use parameterized query to prevent SQL injection
    );
    // Send the newly created question back as JSON
    // Add empty comments array for frontend compatibility
    const newQuestion = {
        ...result.rows[0],
        comments: [] // Placeholder
    };
    res.status(201).json(newQuestion); // 201 Created status
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
    // Update the vote count for the specified question ID
    // Increment votes by 1 WHERE the id matches
    // RETURNING id ensures we know if a row was actually updated
    const result = await pool.query(
      'UPDATE questions SET votes = votes + 1 WHERE id = $1 RETURNING id, votes',
      [questionId]
    );

    // Check if a row was actually updated (i.e., the question ID exists)
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    // Send success response (e.g., the updated vote count or just status 200)
    res.status(200).json({ message: 'Vote recorded successfully.', votes: result.rows[0].votes });

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
        // Insert the new comment, linking it to the question ID
        // Return the newly created comment row
        const result = await pool.query(
            'INSERT INTO comments (question_id, text) VALUES ($1, $2) RETURNING id, question_id, text, created_at',
            [questionId, text.trim()]
        );

        // Check if the insert was successful (should always return 1 row if no error)
        if (result.rowCount === 1) {
            res.status(201).json(result.rows[0]); // Send the new comment back
        } else {
            // This case should ideally not happen if no error was thrown, but good to handle
            throw new Error('Comment insertion failed unexpectedly.');
        }

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
      // Update the is_answered status for the specified question ID
      const result = await pool.query(
          'UPDATE questions SET is_answered = $1 WHERE id = $2 RETURNING id, is_answered',
          [is_answered, questionId]
      );

      // Check if a row was actually updated
      if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Question not found.' });
      }

      // Send success response
      res.status(200).json({ message: 'Answer status updated successfully.', is_answered: result.rows[0].is_answered });

  } catch (err) {
      console.error(`Error updating answer status for question ${questionId}:`, err);
      res.status(500).json({ error: 'Failed to update answer status.' });
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
