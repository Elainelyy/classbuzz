// Poll-related functions
async function createPoll(question, options, pollType) {
  const query = `
    INSERT INTO polls (question, options, poll_type, poll_status, created_at)
    VALUES ($1, $2, $3, 'idle', NOW())
    RETURNING *;
  `;
  const values = [question, options, pollType];
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
    SELECT * FROM polls ORDER BY created_at DESC;
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
  submitPollVote,
  getPollVotes,
  submitOpenAnswer,
  getOpenAnswers
}; 