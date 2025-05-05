const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'spreadsheet.html'));
});
// Serve the simple mapper
app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple-mapper.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
