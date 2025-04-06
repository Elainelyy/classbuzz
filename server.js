    // Import the Express framework
    const express = require('express');
    // Import the path module for working with file paths
    const path = require('path');

    // Create an Express application instance
    const app = express();

    // Define the port the server will listen on.
    // Use the PORT environment variable provided by Heroku, or default to 3000 for local testing.
    const port = process.env.PORT || 3000;

    // Serve static files from the current directory (where server.js is located)
    // This allows access to professor_student_tools.html, CSS, images etc. if they were separate files.
    app.use(express.static(__dirname));

    // Define a route for the root URL ('/')
    // When someone visits the base URL, send them the main HTML file.
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'professor_student_tools.html'));
    });

    // Define a catch-all route to handle any other requests.
    // This is useful for single-page applications where client-side routing handles paths.
    // It sends the main HTML file for any path not explicitly handled above.
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'professor_student_tools.html'));
    });


    // Start the server and listen on the specified port
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
    