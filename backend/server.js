require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const WebSocket = require('ws');
const projectRoutes = require('./routes/projectRoutes');
const authRoutes = require('./routes/authRoutes');
const { initWebSocket } = require('./utils/websocket');

const app = express();
const port = process.env.BACKEND_PORT || 3000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

app.use(cors({ origin: frontendUrl }));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });
initWebSocket(wss);

app.use('/api/projects', projectRoutes);
app.use('/api/auth', authRoutes);

module.exports = app;