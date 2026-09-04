import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { path } = req.query;

  // Static HTML বা মূল পেজ যেন ব্লক না হয়
  if (!path || path === 'index.html') {
    return res.status(200).end();
  }

  try {
    const rawData = await redis.get(path);
    if (!rawData) {
      return res.status(404).send('Short Link Not Found');
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
    return res.status(500).send('Server Error');
  }
}
