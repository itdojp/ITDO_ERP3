import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4100);

app.get('/', (_req, res) => {
  res.type('text/plain').send('SSE demo server. Subscribe to /events for timestamps.');
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    res.write('event: heartbeat\n');
    res.write(`data: ${Date.now()}\n\n`);
  }, 10_000);

  const ticker = setInterval(() => {
    const payload = { timestamp: new Date().toISOString() };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, 2_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(ticker);
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`SSE server ready on http://0.0.0.0:${port}`);
});
