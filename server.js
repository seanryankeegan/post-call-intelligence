const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

// Routes
app.use('/api', require('./routes/analysis'));

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 ACS AI Customer Service Demo running on http://localhost:${PORT}`);
    console.log(`📞 Ready to analyze customer conversations!`);
});