import { initQueue, createApp, setupQueueEvents, setupWebSocket } from '@jet-queue/server';

const PORT = 3001;

// Initialize queue
const queue = await initQueue({ concurrency: 3, autoStart: true });

// Register handlers
queue.registerHandler('send-welcome-email', async (job: any) => {
  console.log(`📧 Sending email to ${job.data.email}`);
  await sleep(2000 + Math.random() * 1000);
  if (Math.random() < 0.15) throw new Error('Email service temporarily unavailable');
  return { sent: true };
});

queue.registerHandler('generate-thumbnail', async (job: any) => {
  console.log(`🖼️ Generating thumbnail for ${job.data.name}`);
  for (let i = 0; i <= 100; i += 25) {
    await sleep(400);
    job.reportProgress?.(i);
  }
  return { url: `https://cdn.example.com/thumbs/${job.data.name}.jpg` };
});

queue.registerHandler('sync-to-crm', async (job: any) => {
  console.log(`📊 Syncing ${job.data.name} to CRM`);
  await sleep(500 + Math.random() * 1000);
  return { synced: true };
});

// Setup WebSocket event forwarding
setupQueueEvents();

// Create Hono app
const app = createApp();

// Start Bun server with WebSocket
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req);
      if (upgraded) return;
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      setupWebSocket(ws);
    },
    message() {}, // not used in demo
    close() {},
  },
});

console.log(`⚡ Demo JetQueue server running at http://localhost:${PORT}`);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}