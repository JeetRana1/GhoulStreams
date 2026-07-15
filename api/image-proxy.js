export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const url = String(req.query.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).send('Missing or invalid url');

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://flashscore.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) return res.status(resp.status).send('Upstream error');

    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await resp.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buf);
  } catch (error) {
    res.status(502).send('Proxy error: ' + error.message);
  }
};
