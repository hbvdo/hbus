import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mainUrl, metaTitle, metaDescription, imageUrl } = req.body;

    if (!mainUrl || !imageUrl) {
      return res.status(400).json({ error: 'Main URL and Image URL are required' });
    }

    const shortId = Math.random().toString(36).substring(2, 8);

    let imageDomain = 'i.imgur.com';
    try {
      imageDomain = new URL(imageUrl).hostname;
    } catch (e) {}

    const data = {
      mainUrl,
      metaTitle: metaTitle || imageDomain,
      metaDescription: metaDescription || '',
      imageUrl,
      imageDomain
    };

    await redis.set(shortId, JSON.stringify(data));

    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';

    return res.status(200).json({ shortUrl: `${protocol}://${host}/${shortId}` });
  } catch (err) {
    return res.status(500).json({ error: 'Database Error', details: err.message });
  }
}
