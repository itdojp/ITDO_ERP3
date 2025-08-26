import express from 'express';
import Redis from 'ioredis';

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
  return {
    invoicesTotal: await redis.llen('invoices'),
    latency,
    orders: {
      creditKeys: creditApproved,
      budgetAllocatedKeys: budgetAllocated
    },
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

app.listen(PORT, () => console.log(`[metrics-dashboard] listening on :${PORT}`));

