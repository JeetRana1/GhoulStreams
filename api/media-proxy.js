const isAbsoluteHttpUrl = (v) => /^https?:\/\//i.test(String(v || '').trim());
const isSegment = (url) => /\.ts(?:[?#]|$)/i.test(url) || /\.txt\?.*X-Amz-/i.test(url);

const proxiedMediaUrl = (targetUrl, referer, rootReferer, baseUrl) => {
  const params = new URLSearchParams({ url: targetUrl });
  if (referer) params.set('referer', referer);
  if (rootReferer) params.set('root_referer', rootReferer);
  const b = String(baseUrl || '').replace(/\/+$/, '');
  return `${b}/api/media-proxy?${params.toString()}`;
};

const selectLowestBandwidthVariant = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const info = String(lines[i] || '').trim();
    if (!info.startsWith('#EXT-X-STREAM-INF:')) continue;
    let j = i + 1;
    while (j < lines.length) {
      const c = String(lines[j] || '').trim();
      if (!c) { j++; continue; }
      if (c.startsWith('#')) break;
      const bw = info.match(/(?:^|,)BANDWIDTH=(\d+)/i);
      variants.push({ bandwidth: bw ? Number(bw[1]) : Infinity, infoLine: lines[i], uriLine: lines[j] });
      break;
    }
  }
  if (!variants.length) return null;
  variants.sort((a, b) => a.bandwidth - b.bandwidth);
  return variants[0];
};

const rewritePlaylist = (text, playlistUrl, rootReferer, baseUrl) => {
  const variant = selectLowestBandwidthVariant(text);
  if (variant) {
    const lines = String(text || '').split(/\r?\n/);
    const preserved = lines.filter(l => {
      const t = String(l || '').trim();
      return t === '#EXTM3U' || t.startsWith('#EXT-X-VERSION') || t.startsWith('#EXT-X-INDEPENDENT-SEGMENTS') || t.startsWith('#EXT-X-MEDIA') || t.startsWith('#EXT-X-SESSION-');
    });
    const abs = new URL(String(variant.uriLine || '').trim(), playlistUrl).toString();
    preserved.push(variant.infoLine);
    preserved.push(proxiedMediaUrl(abs, playlistUrl, rootReferer || playlistUrl, baseUrl));
    return preserved.join('\n');
  }
  return String(text || '').split(/\r?\n/).map(line => {
    const t = String(line || '').trim();
    if (!t || t.startsWith('#')) return line;
    const abs = new URL(t, playlistUrl).toString();
    return proxiedMediaUrl(abs, playlistUrl, rootReferer || playlistUrl, baseUrl);
  }).join('\n');
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const fetchWithFallback = async (url, referer, _rootReferer, isSeg) => {
  const timeoutMs = isSeg ? 7000 : 8000;
  const candidates = [referer, ''];
  if (!candidates.includes(url)) candidates.unshift(url);

  const fetchOne = async (ref) => {
    try {
      const headers = { 'User-Agent': USER_AGENT, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9' };
      if (ref) {
        headers['Referer'] = ref;
        try { headers['Origin'] = new URL(ref).origin; } catch {}
      }
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(to);
      return r;
    } catch { return null; }
  };

  for (const ref of candidates) {
    const r = await fetchOne(ref);
    if (r && (r.ok || r.status === 206)) return { response: r, referer: ref };
  }
  return { response: null, referer: '' };
};

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Referer, Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const targetUrl = String(req.query.url || req.query.URL || '').trim();
    const referer = String(req.query.referer || req.query.Referer || '').trim();
    const rootReferer = String(req.query.root_referer || req.query.rootReferer || '').trim();

    if (!isAbsoluteHttpUrl(targetUrl)) {
      return res.status(400).json({ error: 'Invalid target URL' });
    }

    const isSeg = isSegment(targetUrl);
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    const { response, referer: usedReferer } = await fetchWithFallback(targetUrl, referer, rootReferer, isSeg);

    if (!response || (!response.ok && response.status !== 206)) {
      return res.status(response?.status || 502).send(`Upstream error: ${response?.status || 502}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const isPlaylist = /mpegurl|m3u8/i.test(contentType) || /\.m3u8/i.test(targetUrl) || /\/playlist\//i.test(targetUrl);

    if (isPlaylist) {
      const body = await response.text();
      const rewritten = rewritePlaylist(body, targetUrl, rootReferer || usedReferer || referer || targetUrl, baseUrl);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(rewritten);
    }

    const cacheSeconds = isSeg ? 86400 : 0;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', isSeg ? `public, max-age=${cacheSeconds}, immutable` : 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    if (response.headers.get('content-length')) {
      res.setHeader('Content-Length', response.headers.get('content-length'));
    }

    const range = req.headers['range'];
    if (range) {
      res.setHeader('Content-Range', response.headers.get('content-range') || '');
      res.status(response.status);
    } else {
      res.status(200);
    }

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (e) {
        console.error('media-proxy stream error:', e);
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
  } catch (error) {
    console.error('media-proxy error:', error);
    if (!res.headersSent) {
      res.status(500).send(error.message);
    } else {
      res.end();
    }
  }
};
