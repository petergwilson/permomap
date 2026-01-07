//Websocket server
//ShareDB server


import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import ShareDB from 'sharedb';
import richText from 'rich-text';
import { WebSocket, WebSocketServer } from 'ws';
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import sharedbPg from 'sharedb-postgres';

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register OT type
ShareDB.types.register(richText.type);

// 1. ShareDB backend with Postgres for persistence
const pg = sharedbPg({
  connection: 'postgresql://postgres:postgres@localhost:5432/gis'
});

const backend = new ShareDB();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(8888, () =>
  console.log('http://localhost:8888')
);

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  const stream = new WebSocketJSONStream(ws);
  backend.listen(stream);
});

// Create initial doc if needed
const connection = backend.connect();

const collectionName = 'documents';
const docId = 'mydoc';

const doc = connection.get('documents', 'mydoc');


doc.fetch(err => {
  if (err) throw err;
  if (doc.type === null) {
    // First time: create with a blank line (Quill needs at least \n)
    doc.create([{ insert: '\n' }], 'rich-text');
    console.log('Created initial document: documents/mydoc');
  } else {
    console.log('Loaded document: documents/mydoc');
  }
});