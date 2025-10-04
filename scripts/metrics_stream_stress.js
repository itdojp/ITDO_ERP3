#!/usr/bin/env node
import { setTimeout as delay } from 'timers/promises';

const url = process.env.METRICS_STREAM_URL || `http://localhost:${process.env.PM_PORT || '3001'}/metrics/stream`;
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clients = parsePositiveInt(process.env.METRICS_STREAM_CLIENTS, 10);
const timeoutMs = parsePositiveInt(process.env.METRICS_STREAM_TIMEOUT_MS, 8000);
const iterations = parsePositiveInt(process.env.METRICS_STREAM_ITERATIONS, 1);
const iterationDelayMs = parsePositiveInt(process.env.METRICS_STREAM_ITERATION_DELAY_MS, 250);
const mode = (process.env.METRICS_STREAM_MODE || 'sse').toLowerCase();
const wsPath = process.env.METRICS_STREAM_WS_PATH || process.env.METRICS_STREAM_URL || `ws://localhost:${process.env.PM_PORT || '3001'}/metrics/stream`;

async function openClient(id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    let buffered = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += new TextDecoder().decode(value);
      if (buffered.includes('\n\n')) {
        console.log(`[client ${id}] received payload:`, buffered.trim().split('\n')[0]);
        controller.abort();
        return true;
      }
    }
  } catch (error) {
    console.error(`[client ${id}] SSE error`, error.message || error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
  return false;
}

async function openWebSocketClient(id) {
  let WebSocketImpl = globalThis.WebSocket;
  if (!WebSocketImpl) {
    try {
      WebSocketImpl = (await import('ws')).WebSocket;
    } catch (error) {
      console.error('[metrics] ws module not available', error.message || error);
      return false;
    }
  }
  return await new Promise((resolve) => {
    const socket = new WebSocketImpl(wsPath);
    const timer = setTimeout(() => {
      socket.close();
      console.error(`[client ${id}] WS timeout`);
      resolve(false);
    }, timeoutMs);
    socket.onmessage = (event) => {
      clearTimeout(timer);
      socket.close();
      console.log(`[client ${id}] WS received:`, String(event.data).slice(0, 80));
      resolve(true);
    };
    socket.onerror = (error) => {
      clearTimeout(timer);
      console.error(`[client ${id}] WS error`, error.message || error);
      socket.close();
      resolve(false);
    };
  });
}

async function runIteration(iteration) {
  console.log(`[iteration ${iteration}/${iterations}] starting metrics stream stress test (${clients} clients)`);
  const tasks = [];
  for (let index = 0; index < clients; index += 1) {
    await delay(50);
    tasks.push(mode === 'ws' ? openWebSocketClient(index + 1) : openClient(index + 1));
  }
  const results = await Promise.all(tasks);
  const success = results.filter(Boolean).length;
  console.log(`[iteration ${iteration}/${iterations}] SSE clients succeeded: ${success}/${clients}`);
  return success;
}

async function main() {
  let totalSuccess = 0;
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const success = await runIteration(iteration);
    totalSuccess += success;
    if (iteration < iterations) {
      await delay(iterationDelayMs);
    }
  }
  console.log(`SSE clients succeeded across iterations: ${totalSuccess}/${clients * iterations}`);
  if (totalSuccess === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('metrics_stream_stress failed', error);
  process.exitCode = 1;
});
