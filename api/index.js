import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method } = req;
  const path = req.url.split('?')[0].replace('/', '');

  // ১. লিঙ্ক শর্ট করার API endpoint
  if (method === 'POST') {
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
      return res.status(500).json({ error: 'Failed to save to database', details: err.message });
    }
  }

  // ২. শর্ট লিঙ্ক হ্যান্ডলার (Bot Check & Redirect)
  if (method === 'GET' && path && path !== 'api') {
    try {
      const rawData = await redis.get(path);
      if (!rawData) {
        return res.status(404).send('Link not found');
      }

      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const userAgent = req.headers['user-agent'] || '';

      const isBot = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|skypeuripreview|discordbot/i.test(userAgent);

      if (isBot) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:site_name" content="${data.imageDomain}">
              <meta property="og:title" content="${data.metaTitle}">
              <meta property="og:description" content="${data.metaDescription}">
              <meta property="og:image" content="${data.imageUrl}">
              <meta name="twitter:card" content="summary_large_image">
            </head>
            <body></body>
          </html>
        `);
      }

      return res.redirect(302, data.mainUrl);
    } catch (err) {
      return res.status(500).send('Server error');
    }
  }

  return res.status(400).json({ error: 'Invalid Request' });
}
