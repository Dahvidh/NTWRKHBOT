const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function extractHashtags(text) {
  const matches = text.match(/#[a-zA-Z0-9_]+/g) || [];
  return Array.from(new Set(matches.map((t) => t.toLowerCase())));
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

async function expandHashtagsWithAI(caption, baseTags) {
  const fallbackMap = {
    '#tech': ['#techcommunity', '#innovation', '#buildinpublic'],
    '#lagos': ['#lagosbusiness', '#naijacreators', '#lagoslife'],
    '#fashion': ['#styleinspo', '#streetwear', '#ootd'],
    '#comedy': ['#skits', '#viralcomedy', '#funnyvideos'],
    '#music': ['#afrobeats', '#newmusic', '#indieartist'],
  };

  if (!openai) {
    const extra = [];
    for (const tag of baseTags) {
      if (fallbackMap[tag]) extra.push(...fallbackMap[tag]);
    }
    if (extra.length === 0) extra.push('#trending', '#discover', '#ntwrkh');
    return Array.from(new Set([...baseTags, ...extra])).slice(0, 10);
  }

  try {
    const prompt = `You are NTWRKH's social distribution AI. Given the post caption and initial hashtags, return ONLY a JSON array of 6 to 8 high-intent discovery hashtags (lowercase, starting with #) that connect this content to its ideal niche audience on Instagram and TikTok.
Caption: "${caption}"
Initial tags: ${JSON.stringify(baseTags)}`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const raw = res.choices[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set([...baseTags, ...parsed.map((t) => t.toLowerCase())])
      ).slice(0, 10);
    }
  } catch (err) {
    console.error('[AI Engine] Fallback triggered:', err.message);
  }

  return Array.from(new Set([...baseTags, '#discover', '#ntwrkh'])).slice(0, 8);
}

module.exports = {
  extractHashtags,
  extractUrl,
  expandHashtagsWithAI,
};
