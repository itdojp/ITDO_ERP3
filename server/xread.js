import { createClient } from 'redis';

const streamKey = process.env.CKM_STREAM_KEY ?? 'ckm:events';
const groupName = process.env.CKM_STREAM_GROUP ?? 'ckm-demo';
const consumerName = process.env.CKM_STREAM_CONSUMER ?? `consumer-${process.pid}`;
const blockMs = Number(process.env.CKM_STREAM_BLOCK ?? 5000);
const redisUrl = process.env.CKM_REDIS_URL ?? 'redis://localhost:7637';

const client = createClient({ url: redisUrl });

async function ensureGroup() {
  try {
    await client.xGroupCreate(streamKey, groupName, '$', { MKSTREAM: true });
    console.log(`[redis] consumer group '${groupName}' created on stream '${streamKey}'.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('BUSYGROUP')) {
      console.log(`[redis] consumer group '${groupName}' already exists.`);
    } else {
      throw error;
    }
  }
}

async function main() {
  await client.connect();
  console.log(`[redis] connected to ${redisUrl}`);
  await ensureGroup();

  while (true) {
    const response = await client.xReadGroup(groupName, consumerName, [{ key: streamKey, id: '>' }], {
      COUNT: 10,
      BLOCK: blockMs,
    });

    if (!response) {
      continue;
    }

    for (const stream of response) {
      for (const message of stream.messages) {
        const { id, message: data } = message;
        console.log(`[redis] message ${id}`, data);
        await client.xAck(streamKey, groupName, id);
      }
    }
  }
}

main()
  .catch((error) => {
    console.error('[redis] consumer error', error);
  })
  .finally(async () => {
    await client.disconnect();
  });
