const axios = require('axios');

/**
 * Publishes an Image or Reel to Instagram Graph API
 */
async function publishToInstagram(socialAccount, { caption, mediaUrl, isVideo }) {
  if (!mediaUrl) {
    return { ok: false, reason: 'Instagram requires an image or video attachment.' };
  }

  const igUserId = socialAccount.providerUserId;
  const accessToken = socialAccount.accessToken;

  try {
    // 1. Create media container
    const containerPayload = isVideo
      ? {
          media_type: 'REELS',
          video_url: mediaUrl,
          caption,
          access_token: accessToken,
        }
      : {
          image_url: mediaUrl,
          caption,
          access_token: accessToken,
        };

    const createRes = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      containerPayload
    );
    const creationId = createRes.data.id;

    // 2. Poll container status until FINISHED (max 60s)
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await axios.get(
        `https://graph.facebook.com/v21.0/${creationId}?fields=status_code&access_token=${accessToken}`
      );
      const status = statusRes.data.status_code;
      if (status === 'FINISHED') break;
      if (status === 'ERROR') throw new Error('Instagram media processing failed.');
    }

    // 3. Publish media container
    const publishRes = await axios.post(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    return { ok: true, id: publishRes.data.id };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('[Instagram Publish Error]', msg);
    return { ok: false, reason: msg };
  }
}

/**
 * Publishes a Video to TikTok Content Posting API v2 via PULL_FROM_URL
 */
async function publishToTikTok(socialAccount, { caption, mediaUrl, isVideo }) {
  if (!mediaUrl || !isVideo) {
    return { ok: false, reason: 'TikTok Content Posting API requires a video file.' };
  }

  try {
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: caption.slice(0, 150),
          privacy_level: 'SELF_ONLY', // Change to PUBLIC_TO_EVERYONE once TikTok audit approves Direct Post
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrl,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${socialAccount.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      }
    );

    return { ok: true, publishId: res.data?.data?.publish_id };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('[TikTok Publish Error]', msg);
    return { ok: false, reason: msg };
  }
}

module.exports = {
  publishToInstagram,
  publishToTikTok,
};
