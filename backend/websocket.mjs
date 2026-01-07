import { WebSocketServer } from 'ws';
//Websocket server stuff here
//The websocket server (different protocol from HTTP) runs for the real-time multi-user editing


const wss = new WebSocketServer({ port: 1234 });

wss.on('connection', ws => {
  console.log('Client connected');

  ws.on('message', message => {
    console.log(`Received: ${message}`);
    ws.send(`Server received: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', console.error);
});


console.log('WebSocket server running on ws://localhost:1234');