import { createServer, IncomingMessage, ServerResponse } from 'http';

const clients: ServerResponse[] = [];

function broadcast(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => res.write(payload));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clients.push(res);
    req.on('close', () => {
      const idx = clients.indexOf(res);
      if (idx !== -1) clients.splice(idx, 1);
    });
    return;
  }

  if (req.url === '/twilio' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        broadcast(data);
      } catch (err) {
        console.error('Failed to parse incoming Twilio payload', err);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Twilio server listening on http://localhost:${port}`);
});
