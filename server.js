// Import necessary modules
const express = require('express');
const path = require('path');
const cors = require('cors'); // Import CORS middleware
const db = require('./db'); // Import database functions
const multer = require('multer');
const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Create an Express application instance
const app = express();

// Define the port the server will listen on.
const port = process.env.PORT || 3000;

// Configure AWS S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Function to extract S3 key from image URL
function extractS3KeyFromUrl(imageUrl) {
    if (!imageUrl) return null;
    const url = new URL(imageUrl);
    return url.pathname.substring(1); // Remove leading slash
}

// Configure multer for memory storage (we'll upload directly to S3)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Only allow image files
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// --- Middleware ---
// Enable CORS for all origins (adjust in production if needed)
app.use(cors());
// Enable Express to parse JSON request bodies with increased size limit
app.use(express.json({ limit: '10mb' }));

const path = require('path'); // Make sure to require 'path' at the top
// Serve static files ONLY from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

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
    const { question, options, poll_type, imageDataUrl, existingImageUrl } = req.body;
    
    // Validate that at least one of question or image is provided
    if (!question && !imageDataUrl && !existingImageUrl) {
      return res.status(400).json({ error: 'Either question or image must be provided' });
    }
    
    if (!poll_type) {
      return res.status(400).json({ error: 'Poll type is required' });
    }

    let image_url = existingImageUrl; // Use existing URL if provided
    
    // Process image data URL if provided (upload to S3)
    if (imageDataUrl) {
      try {
        console.log('Processing image data URL for S3 upload');
        
        // Extract the base64 data
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate a unique filename
        const fileName = `polls/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
        
        // Determine content type from data URL
        const contentType = imageDataUrl.match(/^data:(.*?);/)[1] || 'image/jpeg';
        
        // Upload to S3
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: contentType
        });
        
        await s3Client.send(command);
        console.log('S3 upload successful for new poll image');
        
        // Construct the S3 URL
        image_url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        console.log('Generated S3 URL:', image_url);
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image to S3' });
      }
    }

    // Create the poll with the image URL (either from S3 upload or existing)
    const poll = await db.createPoll(question || '', options, poll_type, image_url);
    res.status(201).json(poll);
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Update poll details
app.patch('/api/polls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, poll_type, imageDataUrl, existingImageUrl } = req.body;
    
    if (!question && !imageDataUrl && !existingImageUrl) {
      return res.status(400).json({ error: 'Either question or image must be provided' });
    }
    
    if (!poll_type) {
      return res.status(400).json({ error: 'Poll type is required' });
    }
    
    // Validate poll_type
    if (!['single_choice', 'multiple_choice', 'open_ended'].includes(poll_type)) {
      return res.status(400).json({ error: 'Invalid poll type' });
    }
    
    // For non-open-ended polls, validate options
    if (poll_type !== 'open_ended' && (!options || options.length < 2)) {
      return res.status(400).json({ 
        error: 'Non-open-ended polls require at least two options' 
      });
    }
    
    // Get existing poll to check if we need to delete old image
    const existingPoll = await db.getPollById(id);
    if (!existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    let image_url = existingImageUrl;
    
    // Process image data URL if provided (upload to S3)
    if (imageDataUrl) {
      try {
        console.log('Processing image data URL for S3 upload (update)');
        
        // Extract the base64 data
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate a unique filename
        const fileName = `polls/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
        
        // Determine content type from data URL
        const contentType = imageDataUrl.match(/^data:(.*?);/)[1] || 'image/jpeg';
        
        // Upload to S3
        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: contentType
        });
        
        await s3Client.send(command);
        console.log('S3 upload successful for updated poll image');
        
        // Construct the S3 URL
        image_url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        console.log('Generated S3 URL:', image_url);
        
        // If there was a previous image, attempt to delete it
        if (existingPoll.image_url && existingPoll.image_url !== image_url && existingPoll.image_url !== existingImageUrl) {
          try {
            const s3Key = extractS3KeyFromUrl(existingPoll.image_url);
            if (s3Key) {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: s3Key
              }));
              console.log(`Successfully deleted old image from S3: ${s3Key}`);
            }
          } catch (deleteError) {
            console.error('Error deleting old image from S3:', deleteError);
            // Continue even if deletion fails
          }
        }
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image to S3' });
      }
    }
    
    // Update the poll with the image URL (either from S3 upload or existing)
    const updatedPoll = await db.updatePoll(id, { 
      question, 
      options, 
      poll_type, 
      image_url 
    });
    
    res.json(updatedPoll);
  } catch (error) {
    console.error('Error updating poll:', error);
    res.status(500).json({ error: 'Failed to update poll' });
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

// Delete a poll
app.delete('/api/polls/:id', async (req, res) => {
    try {
        console.log('Starting poll deletion for ID:', req.params.id);
        
        // First get the poll to check if it has an image
        const poll = await db.getPollById(req.params.id);
        console.log('Retrieved poll:', poll);
        
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // If poll has an image, delete it from S3
        if (poll.image_url) {
            console.log('Poll has image URL:', poll.image_url);
            const s3Key = extractS3KeyFromUrl(poll.image_url);
            console.log('Extracted S3 key:', s3Key);
            
            if (s3Key) {
                try {
                    console.log('Attempting to delete from S3 with params:', {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key
                    });
                    
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: s3Key
                    }));
                    console.log(`Successfully deleted image from S3: ${s3Key}`);
                } catch (s3Error) {
                    console.error('Error deleting image from S3:', s3Error);
                    console.error('S3 Error details:', {
                        message: s3Error.message,
                        code: s3Error.code,
                        statusCode: s3Error.statusCode
                    });
                    // Continue with poll deletion even if image deletion fails
                }
            } else {
                console.log('Could not extract S3 key from URL');
            }
        } else {
            console.log('Poll has no image URL');
        }

        // Delete the poll from the database
        console.log('Deleting poll from database');
        await db.deletePoll(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error in delete poll endpoint:', error);
        res.status(500).json({ error: 'Failed to delete poll' });
    }
});

// Update the upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Generate a unique filename
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExtension}`;

        console.log('Attempting to upload to S3 with params:', {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            ContentType: req.file.mimetype
        });

        // Upload to S3 without ACL
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        });

        const result = await s3Client.send(command);
        console.log('S3 upload successful:', result);

        // Construct the S3 URL
        const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        // Return the S3 URL
        res.json({ 
            imageUrl: imageUrl 
        });
    } catch (error) {
        console.error('Error uploading to S3:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            region: process.env.AWS_REGION,
            bucket: process.env.AWS_S3_BUCKET_NAME
        });
        res.status(500).json({ error: error.message });
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
