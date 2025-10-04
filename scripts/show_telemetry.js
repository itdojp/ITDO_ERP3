#!/usr/bin/env node
const base = process.env.TELEMETRY_BASE || `http://localhost:${process.env.PM_PORT || '3001'}`;
const url = `${base.replace(/\/$/, '')}/api/v1/telemetry/ui`;

async function main() {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch telemetry (${res.status})`);
  }
  const payload = await res.json();
  const items = Array.isArray(payload.items) ? payload.items : [];
  console.log(`Latest UI telemetry events (${items.length})`);
  for (const item of items.slice(0, Number(process.env.TELEMETRY_LIMIT || '20'))) {
    console.log(`${item.receivedAt || item.timestamp || 'unknown'} - ${item.component || 'unknown'}:${item.event || 'event'}`);
    if (item.detail) {
      console.log('  detail:', JSON.stringify(item.detail));
    }
  }
}

main().catch((error) => {
  console.error('show_telemetry failed:', error.message || error);
  process.exitCode = 1;
});
