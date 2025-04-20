// Base URL for API - relative to current domain
const API_BASE_URL = window.location.origin;

// Poll API client
const pollApi = {
  // Fetch all polls
  async getAllPolls() {
    const response = await fetch(`${API_BASE_URL}/api/polls`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  // Create a new poll
  async createPoll(pollData) {
    const response = await fetch(`${API_BASE_URL}/api/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pollData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Update an existing poll
  async updatePoll(pollId, pollData) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pollData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Update poll status
  async updatePollStatus(pollId, status) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  // Submit a vote
  async submitVote(pollId, userId, selectedOptionIndex) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, selectedOptionIndex })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Submit an open answer
  async submitOpenAnswer(pollId, userId, answerText) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/open-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, answerText })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Get poll results
  async getPollResults(pollId) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}/results`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  // Delete a poll
  async deletePoll(pollId) {
    const response = await fetch(`${API_BASE_URL}/api/polls/${pollId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
  }
};

export default pollApi; 