require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const WebSocket = require('ws');
const projectRoutes = require('./routes/projectRoutes');
const authRoutes = require('./routes/authRoutes');
const { initWebSocket } = require('./utils/websocket');

const app = express();
const port = process.env.BACKEND_PORT || 3200;
const frontendUrl = process.env.FRONTEND_URL || 'https://uiux.repsdeltsgear.store';

// Настройка CORS
app.use(cors({
  origin: [frontendUrl, 'https://uiux.repsdeltsgear.store'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Обработка предварительных запросов OPTIONS
app.options('*', cors());

// Увеличение лимита тела запроса
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

mongoose.connect(process.env.MONGO_URI);

const server = app.listen(port, () => console.log(`Server running on port ${port}`));
const wss = new WebSocket.Server({ server });
initWebSocket(wss);

app.use('/api/projects', projectRoutes);
app.use('/api/auth', authRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;