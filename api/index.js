import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // ১. লিঙ্ক জেনারেট করার API
  if (req.method === 'POST' && req.url === '/api/shorten') {
    const { mainUrl, metaTitle, metaDescription, imageUrl } = req.body;
    const shortId = Math.random().toString(36).substring(2, 8); // ৬ ডিজিটের র্যান্ডম আইডি

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
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    return res.status(200).json({ shortUrl: `${protocol}://${host}/${shortId}` });
  }

  // ২. শর্ট লিঙ্কে ঢুকলে (Bot vs Human Logic)
  const path = req.url.split('?')[0].replace('/', '');
  if (path && path !== 'api/shorten') {
    const rawData = await redis.get(path);
    if (!rawData) {
      return res.status(404).send('Link not found');
    }

    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    const userAgent = req.headers['user-agent'] || '';
    
    // সোশ্যাল মিডিয়া বটের লিস্ট
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

    // আসল মানুষ হলে Main Link-এ পাঠিয়ে দেওয়া
    return res.redirect(302, data.mainUrl);
  }

  return res.status(400).json({ error: 'Invalid Request' });
}
