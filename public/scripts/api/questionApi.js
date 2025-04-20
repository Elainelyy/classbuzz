// Base URL for API - relative to current domain
const API_BASE_URL = window.location.origin;

// Question API client
const questionApi = {
  // Fetch all questions
  async getAllQuestions() {
    const response = await fetch(`${API_BASE_URL}/api/questions`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  // Create a new question
  async createQuestion(questionData) {
    const response = await fetch(`${API_BASE_URL}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Update an existing question
  async updateQuestion(questionId, questionData) {
    const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Delete a question
  async deleteQuestion(questionId) {
    const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Vote for a question
  async voteQuestion(questionId) {
    const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  // Mark a question as answered
  async markQuestionAnswered(questionId) {
    const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/answered`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  },

  // Get question statistics
  async getQuestionStats(questionId) {
    const response = await fetch(`${API_BASE_URL}/api/questions/${questionId}/stats`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }
};

export { questionApi }; 