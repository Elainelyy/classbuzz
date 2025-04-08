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
    // Query the database to get all questions
    // Order them similarly to the frontend logic: unanswered first, then by votes, then by time
    const result = await pool.query(
      'SELECT id, text, votes, is_answered, created_at FROM questions ORDER BY is_answered ASC, votes DESC, created_at ASC'
    );
    // Send the rows back as JSON
    // Map results to include an empty comments array for frontend compatibility for now
    const questionsWithComments = result.rows.map(q => ({
        ...q,
        comments: [] // Placeholder - Fetch actual comments in a future step
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
