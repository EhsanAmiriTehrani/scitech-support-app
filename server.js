const express = require('express');
const app = express();
const path = require('path');
const port = process.env.PORT || 3000;

// Serve static React files
app.use(express.static(path.join(__dirname, 'client/build')));


// Middleware for parsing JSON requests
app.use(express.json());

// Sample route
app.get('/', (req, res) => {
    res.send('Welcome to the SciTech Support App!');
});

// Additional routes can be defined here

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});