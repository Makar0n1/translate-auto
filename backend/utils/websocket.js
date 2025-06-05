let clients = [];

exports.initWebSocket = (wss) => {
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    clients.push(ws);
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients = clients.filter(client => client !== ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  });
};

exports.broadcast = (message) => {
  console.log('Broadcasting message:', message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error.message);
      }
    }
  });
};