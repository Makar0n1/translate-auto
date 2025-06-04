let clients = [];

exports.initWebSocket = (wss) => {
  wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('close', () => {
      clients = clients.filter(client => client !== ws);
    });
  });
};

exports.broadcast = (message) => {
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
};