require('dotenv').config();
const { Worker } = require('bullmq');
const axios = require('axios');
const { connection } = require('./queue');
const { uploadFromTelegram, uploadFromWhatsApp } = require('./mediaUploader');
const { handleIncomingMessage } = require('./botRouter');

async function notifyUser(platform, platformUserId, text) {
  if (platform === 'telegram' && process.env.TELEGRAM_BOT_TOKEN) {
    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: platformUserId,
        text,
        parse_mode: 'Markdown',
      }
    );
  } else if (
    platform === 'whatsapp' &&
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: platformUserId,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

const worker = new Worker(
  'ntwrkh-distribution',
  async (job) => {
    const {
      platform,
      platformUserId,
      displayName,
      caption = '',
      mediaUrl = null,
      rawMedia = null,
    } = job.data;

    console.log(`[Worker] Processing job ${job.id} for ${platform}:${platformUserId}`);

    let finalMediaUrl = mediaUrl;

    if (rawMedia && !finalMediaUrl) {
      const uploaded =
        rawMedia.source === 'telegram'
          ? await uploadFromTelegram(rawMedia.id, rawMedia.type)
          : await uploadFromWhatsApp(rawMedia.id, rawMedia.type);

      finalMediaUrl = uploaded.url;
    }

    const combinedText = `${caption} ${finalMediaUrl || ''}`.trim();
    const resultMessage = await handleIncomingMessage({
      platform,
      platformUserId,
      displayName,
      text: combinedText,
    });

    await notifyUser(platform, platformUserId, resultMessage);
    return { status: 'completed', finalMediaUrl };
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} finished successfully.`);
});

worker.on('failed', async (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    await notifyUser(
      job.data.platform,
      job.data.platformUserId,
      `⚠️ We hit a snag publishing your content (${err.message}). Please check your connected accounts with *connect* and try again.`
    );
  }
});

console.log('NTWRKH BullMQ Worker listening for jobs...');
