const { Pool } = require('pg'); // Import PostgreSQL client

// Create a connection pool using the DATABASE_URL environment variable
// Heroku automatically sets DATABASE_URL. For local development, you'll need to set it.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add SSL configuration for Heroku connections
  // (Heroku requires SSL, but disable it for local connections unless you set up local SSL)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Question-related functions
async function getAllQuestions() {
  const query = `
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
  `;
  const result = await pool.query(query);
  
  // Process the results to ensure comments is always an array
  return result.rows.map(q => ({
    ...q,
    comments: q.comments || [] // Ensure comments is an array even if null
  }));
}

async function createQuestion(text) {
  const query = 'INSERT INTO questions (text) VALUES ($1) RETURNING id, text, votes, is_answered, created_at';
  const result = await pool.query(query, [text.trim()]);
  return result.rows[0];
}

async function voteQuestion(questionId) {
  const query = 'UPDATE questions SET votes = votes + 1 WHERE id = $1 RETURNING id, votes';
  const result = await pool.query(query, [questionId]);
  return result.rows[0];
}

async function addCommentToQuestion(questionId, text) {
  const query = 'INSERT INTO comments (question_id, text) VALUES ($1, $2) RETURNING id, question_id, text, created_at';
  const result = await pool.query(query, [questionId, text.trim()]);
  return result.rows[0];
}

async function updateQuestionAnsweredStatus(questionId, isAnswered) {
  const query = 'UPDATE questions SET is_answered = $1 WHERE id = $2 RETURNING id, is_answered';
  const result = await pool.query(query, [isAnswered, questionId]);
  return result.rows[0];
}

// Poll-related functions
async function createPoll(question, options, pollType) {
  const query = `
    INSERT INTO polls (question, options, poll_type, poll_status, created_at)
    VALUES ($1, $2, $3, 'idle', NOW())
    RETURNING *;
  `;
  // For open_ended polls, set options to NULL
  // For other types, ensure options is an array with at least 2 elements
  const values = [
    question,
    pollType === 'open_ended' ? null : options,
    pollType
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getPollById(pollId) {
  const query = `
    SELECT * FROM polls WHERE id = $1;
  `;
  const result = await pool.query(query, [pollId]);
  return result.rows[0];
}

async function getAllPolls() {
  const query = `
    SELECT 
      id,
      question,
      COALESCE(options, '{}'::TEXT[]) as options,
      poll_type,
      poll_status,
      created_at
    FROM polls 
    ORDER BY created_at DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function updatePollStatus(pollId, status) {
  const query = `
    UPDATE polls 
    SET poll_status = $1
    WHERE id = $2
    RETURNING *;
  `;
  const result = await pool.query(query, [status, pollId]);
  return result.rows[0];
}

// Update a poll
const updatePoll = async (id, { question, options, poll_type }) => {
  // For open_ended polls, options should be NULL
  const pollOptions = poll_type === 'open_ended' ? null : options;
  
  const result = await pool.query(
    `UPDATE polls 
     SET question = $1, 
         options = $2, 
         poll_type = $3
     WHERE id = $4
     RETURNING id, question, options, poll_type, status, created_at`,
    [question, pollOptions, poll_type, id]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Poll not found');
  }
  
  return result.rows[0];
};

// Function to delete a poll
async function deletePoll(pollId) {
  // First, delete related data in child tables
  try {
    // Delete poll votes
    await pool.query('DELETE FROM poll_votes WHERE poll_id = $1', [pollId]);
    
    // Delete open answers
    await pool.query('DELETE FROM poll_open_answers WHERE poll_id = $1', [pollId]);
    
    // Delete the poll itself
    const query = 'DELETE FROM polls WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [pollId]);
    
    // Return true if a poll was deleted
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error in deletePoll:', error);
    throw error;
  }
}

// Poll votes functions
async function submitPollVote(pollId, userId, selectedOptionIndex) {
  const query = `
    INSERT INTO poll_votes (poll_id, user_id, selected_option_index, created_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING *;
  `;
  const values = [pollId, userId, selectedOptionIndex];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getPollVotes(pollId) {
  const query = `
    SELECT * FROM poll_votes WHERE poll_id = $1;
  `;
  const result = await pool.query(query, [pollId]);
  return result.rows;
}

// Open answers functions
async function submitOpenAnswer(pollId, userId, answerText) {
  const query = `
    INSERT INTO poll_open_answers (poll_id, user_id, answer_text, created_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING *;
  `;
  const values = [pollId, userId, answerText];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getOpenAnswers(pollId) {
  const query = `
    SELECT * FROM poll_open_answers WHERE poll_id = $1;
  `;
  const result = await pool.query(query, [pollId]);
  return result.rows;
}

// Export the new functions
module.exports = {
  // ... existing exports ...
  createPoll,
  getPollById,
  getAllPolls,
  updatePollStatus,
  updatePoll,
  deletePoll,
  submitPollVote,
  getPollVotes,
  submitOpenAnswer,
  getOpenAnswers,
  getAllQuestions,
  createQuestion,
  voteQuestion,
  addCommentToQuestion,
  updateQuestionAnsweredStatus
}; 