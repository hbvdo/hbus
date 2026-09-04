import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { path } = req.query;

  // Root বা index.html রিকোয়েস্ট এলে ফাঁকা রেসপন্স
  if (!path || path === 'index.html') {
    return res.status(200).end();
  }

  try {
    // Redis ডাটাবেস থেকে শর্ট আইডির ডাটা খোঁজা
    const rawData = await redis.get(path);
    if (!rawData) {
      return res.status(404).send('Short Link Not Found');
    }

    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    const userAgent = req.headers['user-agent'] || '';

    // ১. সোশ্যাল মিডিয়া স্ক্র্যাপার বট সনাক্তকরণ
    const isBot = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|skypeuripreview|discordbot/i.test(userAgent);

    // ২. বট হলে সরাসরি ইমেজ URL-এ রিডাইরেক্ট (Domain Spoofing-এর জন্য)
    if (isBot) {
      return res.redirect(302, data.imageUrl);
    }

    // ৩. মানব ব্যবহারকারী হলে মূল Destination URL-এ রিডাইরেক্ট
    return res.redirect(302, data.mainUrl);

  } catch (err) {
    return res.status(500).send('Server Error');
  }
}
