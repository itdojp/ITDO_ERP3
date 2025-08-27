import express from 'express';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import amqp from 'amqplib';

const PORT = parseInt(process.env.PORT || '3005', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(REDIS_URL);

function percentile(arr, p) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx];
}

async function fetchInvoices(limit = 500) {
  const ids = await redis.lrange('invoices', 0, limit - 1);
  const multi = redis.multi();
  ids.forEach((id) => multi.hgetall(`invoice:${id}`));
  const rows = await multi.exec();
  return rows.map(([, v]) => v).filter(Boolean);
}

async function countByPattern(pattern) {
  let cursor = '0';
  let count = 0;
  do {
    const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
    cursor = res[0];
    count += res[1].length;
  } while (cursor !== '0');
  return count;
}

async function gatherSummary() {
  const invoices = await fetchInvoices();
  const latencies = invoices
    .map((i) => Number(i.latencyMs))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const latency = {
    count: latencies.length,
    avg: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99)
  };
  // credit status counts (approx via SCAN)
  const creditApproved = await countByPattern('order:*:credit');
  const budgetAllocated = await countByPattern('order:*:budget_emitted');
  // event counts (top N)
  const eventCounts = await (async () => {
    let cursor = '0';
    const map = new Map();
    do {
      const res = await redis.scan(cursor, 'MATCH', 'metrics:events:*', 'COUNT', 1000);
      cursor = res[0];
      const keys = res[1];
      if (keys.length) {
        const vals = await redis.mget(keys);
        keys.forEach((k, idx) => map.set(k.substring('metrics:events:'.length), Number(vals[idx] || 0)));
      }
    } while (cursor !== '0');
    return [...map.entries()].sort((a,b) => b[1]-a[1]).slice(0, 20).map(([type,count]) => ({ type, count }));
  })();
  // queue metrics via RabbitMQ management API
  const queues = await getQueueMetrics();
  return {
    invoicesTotal: await redis.llen('invoices'),
    latency,
    orders: {
      creditKeys: creditApproved,
      budgetAllocatedKeys: budgetAllocated
    },
    events: eventCounts,
    queues,
    timestamp: new Date().toISOString()
  };
}

const app = express();
app.use(express.static('public'));
app.get('/metrics/summary', async (_req, res) => {
  try {
    res.json(await gatherSummary());
  } catch (e) {
    console.error('[metrics] error', e);
    res.status(500).json({ error: 'metrics_failed' });
  }
});

app.post('/ops/redrive', express.json(), async (req, res) => {
  try {
    const count = parseInt((req.body && req.body.count) || '0', 10) || Infinity;
    const amqpUrl = process.env.AMQP_URL || 'amqp://guest:guest@rabbitmq:5672';
    const conn = await amqp.connect(amqpUrl);
    const ch = await conn.createChannel();
    await ch.assertExchange('events', 'direct', { durable: true });
    let redriven = 0;
    const numShards = parseInt(process.env.NUM_SHARDS || '4', 10);
    for (let i = 0; i < numShards; i++) {
      const dead = `shard.${i}.dead`;
      await ch.assertQueue(dead, { durable: true });
      while (redriven < count) {
        const msg = await ch.get(dead, { noAck: false });
        if (!msg) break;
        // derive live routing key from dead name
        const liveKey = `shard.${i}`;
        ch.publish('events', liveKey, msg.content, { contentType: msg.properties.contentType || 'application/json' });
        ch.ack(msg);
        redriven++;
      }
    }
    await conn.close();
    res.json({ redriven });
  } catch (e) {
    console.error('[ops] redrive error', e);
    res.status(500).json({ error: 'redrive_failed' });
  }
});

async function getQueueMetrics() {
  try {
    const base = process.env.RABBIT_API_URL || 'http://rabbitmq:15672';
    const user = process.env.RABBIT_USER || 'guest';
    const pass = process.env.RABBIT_PASS || 'guest';
    const url = `${base}/api/queues`;
    const res = await fetch(url, { headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    let shardReady = 0, shardUnacked = 0, deadReady = 0;
    for (const q of arr) {
      const name = q.name || '';
      if (name.startsWith('shard.') && name.endsWith('.dead')) {
        deadReady += q.messages || 0;
      } else if (name.startsWith('shard.')) {
        shardReady += q.messages || 0;
        shardUnacked += q.messages_unacknowledged || 0;
      }
    }
    return { shardReady, shardUnacked, deadReady };
  } catch (e) {
    return { error: 'rabbit_api_failed' };
  }
}

app.listen(PORT, () => console.log(`[metrics-dashboard] listening on :${PORT}`));
