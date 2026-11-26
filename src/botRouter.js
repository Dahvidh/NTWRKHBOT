const {
  getOrCreateUser,
  updateUserNiches,
  findMatchedAudience,
  recordPostAndReach,
  createPendingPayment,
} = require('./db');
const { extractHashtags, extractUrl, expandHashtagsWithAI } = require('./aiEngine');
const { publishToInstagram, publishToTikTok } = require('./socialPublishers');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function sendCrossPlatformAlert(targetUser, message) {
  try {
    if (targetUser.platform === 'telegram' && process.env.TELEGRAM_BOT_TOKEN) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: targetUser.platformUserId,
          text: message,
          parse_mode: 'Markdown',
        }
      );
    } else if (
      targetUser.platform === 'whatsapp' &&
      process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID
    ) {
      await axios.post(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: targetUser.platformUserId,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (err) {
    console.error(`[Alert Error -> ${targetUser.platform}:${targetUser.platformUserId}]`, err.message);
  }
}

async function handleIncomingMessage({ platform, platformUserId, displayName, text }) {
  const user = await getOrCreateUser(platform, platformUserId, displayName);
  const trimmed = (text || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Onboarding / Help
  if (lower === 'start' || lower === '/start' || lower === 'hi' || lower === 'help') {
    return (
      `👋 *Welcome to NTWRKH, ${user.displayName}!*\n\n` +
      `I push your content straight to people interested in your hashtags across our creator network & your connected socials.\n\n` +
      `*Commands:*\n` +
      `• *niche #tech #lagos* — Set hashtags you want to discover & reach\n` +
      `• *connect* — Link your Instagram & TikTok accounts\n` +
      `• *Send any video/photo + caption & #hashtags* — AI optimizes tags, publishes to IG/TikTok, and pushes to matched creators\n` +
      `• *stats* — View your reach & connected accounts\n` +
      `• *upgrade* — Unlock Pro unlimited distribution`
    );
  }

  // 2. Set Niche Hashtags
  if (lower.startsWith('niche')) {
    const tags = extractHashtags(trimmed);
    if (tags.length === 0) {
      return `Please include at least one hashtag. Example:\n*niche #afrobeats #lagos #tech*`;
    }
    const updated = await updateUserNiches(user.id, tags);
    return `✅ *Niche profile updated!*\nYou are now tuned into: ${updated.niches.join(', ')}`;
  }

  // 3. Connect Social Accounts
  if (lower === 'connect') {
    const igUrl = `${BASE_URL}/oauth/instagram/start?userId=${user.id}`;
    const ttUrl = `${BASE_URL}/oauth/tiktok/start?userId=${user.id}`;
    return (
      `🔗 *Connect Your Social Accounts*\n\n` +
      `1️⃣ *Instagram Business/Creator:*\n${igUrl}\n\n` +
      `2️⃣ *TikTok Creator Account:*\n${ttUrl}\n\n` +
      `Once linked, send any video or photo here with #hashtags to auto-publish & distribute!`
    );
  }

  // 4. Stats
  if (lower === 'stats') {
    const linked =
      user.socialAccounts.length > 0
        ? user.socialAccounts.map((a) => `${a.provider} (@${a.username || a.providerUserId})`).join(', ')
        : 'None yet (type *connect*)';

    return (
      `📊 *Your NTWRKH Stats*\n\n` +
      `• *Plan:* ${user.plan.toUpperCase()}\n` +
      `• *Posts Distributed:* ${user.postsCount}\n` +
      `• *Estimated Network Reach:* ${user.totalReach.toLocaleString()}\n` +
      `• *Your Niches:* ${user.niches.length ? user.niches.join(', ') : 'Not set'}\n` +
      `• *Connected Accounts:* ${linked}`
    );
  }

  // 5. Upgrade via Paystack
  if (lower === 'upgrade') {
    if (user.plan === 'pro') {
      return `🌟 You are already on *NTWRKH PRO*! Enjoy unlimited hashtag distribution.`;
    }
    const amountNgn = Number(process.env.PRO_PLAN_PRICE_NGN || 15000);
    const reference = `NTWRKH_${user.id}_${Date.now()}`;
    await createPendingPayment(user.id, reference, amountNgn);

    if (process.env.PAYSTACK_SECRET_KEY) {
      try {
        const payRes = await axios.post(
          'https://api.paystack.co/transaction/initialize',
          {
            email: `${user.id}@ntwrkh.app`,
            amount: amountNgn * 100, // Kobo
            reference,
            callback_url: `${BASE_URL}/paystack/callback`,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const authUrl = payRes.data?.data?.authorization_url;
        return `💳 *Upgrade to NTWRKH PRO (₦${amountNgn.toLocaleString()}/mo)*\nComplete payment here:\n${authUrl}`;
      } catch (err) {
        console.error('[Paystack Init Error]', err.message);
      }
    }

    return `💳 *Upgrade to NTWRKH PRO (₦${amountNgn.toLocaleString()}/mo)*\nTest Checkout Link:\n${BASE_URL}/paystack/mock-checkout?reference=${reference}`;
  }

  // 6. Content Distribution Flow (Triggered by hashtags or media URL)
  const baseTags = extractHashtags(trimmed);
  const mediaUrl = extractUrl(trimmed);

  if (baseTags.length === 0 && !mediaUrl) {
    return `Send a video/photo with #hashtags to push it to your niche audience, or type *help* to see all commands.`;
  }

  // Check free tier quota
  if (user.plan === 'free' && user.postsCount >= 5) {
    return `⚠️ You have reached your *5 free distributions*. Type *upgrade* to unlock unlimited NTWRKH Pro distribution!`;
  }

  const captionOnly = mediaUrl ? trimmed.replace(mediaUrl, '').trim() : trimmed;
  const expandedTags = await expandHashtagsWithAI(captionOnly, baseTags);
  const fullCaption = `${captionOnly}\n\n${expandedTags.join(' ')}`.trim();
  const isVideo = Boolean(mediaUrl && /\.(mp4|mov|webm)|\/video\//i.test(mediaUrl));

  // Publish to connected social accounts
  const publishedTargets = [];
  const publishNotes = [];

  for (const acc of user.socialAccounts) {
    if (acc.provider === 'instagram') {
      const res = await publishToInstagram(acc, { caption: fullCaption, mediaUrl, isVideo });
      if (res.ok) {
        publishedTargets.push('instagram');
        publishNotes.push(`✅ Published to Instagram`);
      } else {
        publishNotes.push(`⚠️ Instagram skipped: ${res.reason}`);
      }
    } else if (acc.provider === 'tiktok') {
      const res = await publishToTikTok(acc, { caption: fullCaption, mediaUrl, isVideo });
      if (res.ok) {
        publishedTargets.push('tiktok');
        publishNotes.push(`✅ Pushed to TikTok`);
      } else {
        publishNotes.push(`⚠️ TikTok skipped: ${res.reason}`);
      }
    }
  }

  // Match & notify NTWRKH network users interested in these hashtags
  const matchedUsers = await findMatchedAudience(user.id, expandedTags);

  for (const target of matchedUsers) {
    const alertText =
      `🔥 *NTWRKH Discovery Drop*\n` +
      `Creator *${user.displayName}* just posted in ${expandedTags.slice(0, 3).join(' ')}:\n\n` +
      `"${captionOnly.slice(0, 140)}"\n` +
      (mediaUrl ? `Watch/View: ${mediaUrl}` : '');
    sendCrossPlatformAlert(target, alertText);
  }

  const { simulatedReach } = await recordPostAndReach({
    userId: user.id,
    caption: captionOnly,
    mediaUrl,
    mediaType: mediaUrl ? (isVideo ? 'video' : 'image') : 'text',
    originalTags: baseTags,
    expandedTags,
    matchedUsers: matchedUsers.length,
    publishedTargets,
  });

  return (
    `🚀 *Content Pushed via NTWRKH!*\n\n` +
    `• *AI-Optimized Tags:* ${expandedTags.join(' ')}\n` +
    `• *Niche Creators Notified:* ${matchedUsers.length}\n` +
    `• *Projected Discovery Reach:* +${simulatedReach.toLocaleString()} targeted viewers\n` +
    (publishNotes.length ? `\n${publishNotes.join('\n')}` : `\n💡 Tip: Type *connect* to auto-publish directly to Instagram & TikTok too.`)
  );
}

module.exports = {
  handleIncomingMessage,
};
