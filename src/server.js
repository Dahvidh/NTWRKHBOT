require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Telegraf } = require('telegraf');
const { handleIncomingMessage } = require('./botRouter');
const { enqueueDistributionJob } = require('./queue');
const { upsertSocialAccount, markPaymentSuccess, getUserById } = require('./db');
const { getPrivacyPolicyHtml, getTermsOfServiceHtml } = require('./legalPages');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Capture raw body for Paystack webhook signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ==========================================
// 1. HEALTH CHECK, LANDING & LEGAL ROUTES
// ==========================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'NTWRKH Production API', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NTWRKH — AI Social Content Discovery & Distribution</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 600px; padding: 48px; background: #1e293b; border-radius: 16px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    h1 { font-size: 2.5rem; margin: 0 0 12px; letter-spacing: -0.02em; }
    p { color: #cbd5e1; font-size: 1.1rem; line-height: 1.6; }
    .links { margin-top: 28px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    a.btn { background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { margin-top: 32px; font-size: 0.85rem; color: #94a3b8; }
    .footer a { color: #94a3b8; text-decoration: underline; margin: 0 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>NTWRKH</h1>
    <p>AI-powered content discovery and hashtag distribution bot for creators, influencers, and brands on WhatsApp &amp; Telegram.</p>
    <div class="links">
      <a class="btn" href="https://t.me" target="_blank">Open on Telegram</a>
      <a class="btn" href="https://wa.me" target="_blank" style="background:#10b981;">Open on WhatsApp</a>
    </div>
    <div class="footer">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </div>
  </div>
</body>
</html>`);
});

app.get('/privacy', (_req, res) => {
  res.type('html').send(getPrivacyPolicyHtml(BASE_URL));
});

app.get('/terms', (_req, res) => {
  res.type('html').send(getTermsOfServiceHtml(BASE_URL));
});

// ==========================================
// 2. TELEGRAM BOT INTEGRATION
// ==========================================
if (process.env.TELEGRAM_BOT_TOKEN) {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.on('text', async (ctx) => {
    const reply = await handleIncomingMessage({
      platform: 'telegram',
      platformUserId: String(ctx.from.id),
      displayName: ctx.from.first_name || 'Creator',
      text: ctx.message.text,
    });
    await ctx.reply(reply, { parse_mode: 'Markdown' });
  });

  bot.on(['video', 'photo'], async (ctx) => {
    const isVideo = Boolean(ctx.message.video);
    const fileId = isVideo
      ? ctx.message.video.file_id
      : ctx.message.photo[ctx.message.photo.length - 1].file_id;

    const jobId = await enqueueDistributionJob({
      platform: 'telegram',
      platformUserId: String(ctx.from.id),
      displayName: ctx.from.first_name || 'Creator',
      caption: ctx.message.caption || '',
      rawMedia: {
        source: 'telegram',
        id: fileId,
        type: isVideo ? 'video' : 'image',
      },
    });

    await ctx.reply(
      `🚀 *Queued (#${jobId})!* Uploading your ${isVideo ? 'video' : 'photo'}, optimizing hashtags, and pushing to your connected accounts & NTWRKH audience...`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.launch().then(() => console.log('Telegram bot active.'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// ==========================================
// 3. WHATSAPP CLOUD API WEBHOOKS
// ==========================================
async function sendWhatsAppText(to, body) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;
  await axios.post(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately to prevent Meta retries

  try {
    const entry = req.body?.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return;

    const contactName = value?.contacts?.[0]?.profile?.name || 'Creator';

    if (msg.type === 'text') {
      const reply = await handleIncomingMessage({
        platform: 'whatsapp',
        platformUserId: msg.from,
        displayName: contactName,
        text: msg.text?.body || '',
      });
      await sendWhatsAppText(msg.from, reply);
    } else if (msg.type === 'video' || msg.type === 'image') {
      const mediaObj = msg[msg.type];
      const jobId = await enqueueDistributionJob({
        platform: 'whatsapp',
        platformUserId: msg.from,
        displayName: contactName,
        caption: mediaObj.caption || '',
        rawMedia: {
          source: 'whatsapp',
          id: mediaObj.id,
          type: msg.type,
        },
      });
      await sendWhatsAppText(
        msg.from,
        `🚀 Queued (#${jobId})! Uploading your ${msg.type}, optimizing hashtags, and pushing to your connected accounts & NTWRKH audience...`
      );
    }
  } catch (err) {
    console.error('[WhatsApp Webhook Error]', err.message);
  }
});

// ==========================================
// 4. INSTAGRAM & TIKTOK OAUTH CALLBACKS
// ==========================================
app.get('/oauth/instagram/start', (req, res) => {
  const { userId } = req.query;
  const redirectUri = `${BASE_URL}/oauth/instagram/callback`;
  const scopes = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';
  const authUrl =
    `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(userId || '')}`;
  res.redirect(authUrl);
});

app.get('/oauth/instagram/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('Missing OAuth code or userId state.');

  try {
    const redirectUri = `${BASE_URL}/oauth/instagram/callback`;

    // 1. Exchange code for short-lived token
    const tokenRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    // 2. Exchange for 60-day long-lived user token
    const longRes = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: tokenRes.data.access_token,
      },
    });
    const longToken = longRes.data.access_token;

    // 3. Find linked Facebook Page -> Instagram Business Account
    const pagesRes = await axios.get(
      `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${longToken}`
    );
    const pageWithIg = (pagesRes.data?.data || []).find((p) => p.instagram_business_account);
    if (!pageWithIg) {
      return res.status(400).send('No Instagram Business/Creator account linked to your Facebook Page.');
    }

    const igAccount = pageWithIg.instagram_business_account;
    await upsertSocialAccount(userId, {
      provider: 'instagram',
      providerUserId: igAccount.id,
      username: igAccount.username || 'instagram_creator',
      accessToken: longToken,
      expiresAt: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000),
    });

    res.send(`<h2>✅ Instagram (@${igAccount.username}) connected to NTWRKH!</h2><p>You can close this window and return to WhatsApp or Telegram.</p>`);
  } catch (err) {
    console.error('[Instagram OAuth Error]', err.response?.data || err.message);
    res.status(500).send('Failed to connect Instagram account.');
  }
});

app.get('/oauth/tiktok/start', (req, res) => {
  const { userId } = req.query;
  const redirectUri = `${BASE_URL}/oauth/tiktok/callback`;
  const scopes = 'user.info.basic,video.publish,video.upload';
  const authUrl =
    `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(userId || '')}`;
  res.redirect(authUrl);
});

app.get('/oauth/tiktok/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('Missing TikTok OAuth code or userId state.');

  try {
    const redirectUri = `${BASE_URL}/oauth/tiktok/callback`;
    const tokenRes = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, open_id, expires_in } = tokenRes.data;

    await upsertSocialAccount(userId, {
      provider: 'tiktok',
      providerUserId: open_id,
      username: 'tiktok_creator',
      accessToken: access_token,
      refreshToken: refresh_token || null,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
    });

    res.send(`<h2>✅ TikTok connected to NTWRKH!</h2><p>You can close this window and return to WhatsApp or Telegram.</p>`);
  } catch (err) {
    console.error('[TikTok OAuth Error]', err.response?.data || err.message);
    res.status(500).send('Failed to connect TikTok account.');
  }
});

// ==========================================
// 5. PAYSTACK WEBHOOK & CALLBACKS
// ==========================================
app.post('/webhook/paystack', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (secret) {
    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      return res.sendStatus(401);
    }
  }

  const event = req.body;
  if (event?.event === 'charge.success') {
    const reference = event.data?.reference;
    if (reference) {
      await markPaymentSuccess(reference);
    }
  }

  res.sendStatus(200);
});

app.get('/paystack/callback', (_req, res) => {
  res.send(`<h2>🎉 Payment Received!</h2><p>Your NTWRKH Pro subscription is now active. Return to WhatsApp or Telegram and type <b>stats</b>.</p>`);
});

app.get('/paystack/mock-checkout', async (req, res) => {
  const { reference } = req.query;
  if (!reference) return res.status(400).send('Missing reference');
  await markPaymentSuccess(reference);
  res.send(`<h2>✅ Test Payment Confirmed!</h2><p>Your NTWRKH Pro plan is active. Return to WhatsApp or Telegram.</p>`);
});

app.listen(PORT, () => {
  console.log(`NTWRKH Server listening on port ${PORT} (${BASE_URL})`);
});
