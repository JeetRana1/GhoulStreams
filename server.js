import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import BuffStreams from './BuffStreams.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const provider = new BuffStreams();
const streamAvailability = new Map();

app.use(express.static(__dirname));
app.use(express.json());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const AVAILABILITY_TTL_MS = 1000 * 60 * 45;

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const pruneAvailability = () => {
    const now = Date.now();
    for (const [id, value] of streamAvailability.entries()) {
        if (!value?.updatedAt || now - value.updatedAt > AVAILABILITY_TTL_MS) {
            streamAvailability.delete(id);
        }
    }
};

const setStreamAvailability = (id, isLive, reason = '') => {
    const key = String(id || '').trim();
    if (!key) return;
    streamAvailability.set(key, { isLive: Boolean(isLive), reason: String(reason || ''), updatedAt: Date.now() });
};

const clearStreamAvailability = (id) => {
    const key = String(id || '').trim();
    if (!key) return;
    streamAvailability.delete(key);
};

const getAvailabilitySnapshot = () => {
    pruneAvailability();
    const snapshot = {};
    for (const [id, value] of streamAvailability.entries()) {
        snapshot[id] = value;
    }
    return snapshot;
};

const passthroughHeaders = (headers = {}) => {
    const out = {};
    const contentType = headers['content-type'] || headers.get?.('content-type');
    const contentLength = headers['content-length'] || headers.get?.('content-length');
    const acceptRanges = headers['accept-ranges'] || headers.get?.('accept-ranges');
    const contentRange = headers['content-range'] || headers.get?.('content-range');
    const cacheControl = headers['cache-control'] || headers.get?.('cache-control');

    if (contentType) out['Content-Type'] = contentType;
    if (contentLength) out['Content-Length'] = contentLength;
    if (acceptRanges) out['Accept-Ranges'] = acceptRanges;
    if (contentRange) out['Content-Range'] = contentRange;
    if (cacheControl) out['Cache-Control'] = cacheControl;
    out['Access-Control-Allow-Origin'] = '*';
    return out;
};

const proxiedMediaUrl = (targetUrl, referer, rootReferer) => {
    const params = new URLSearchParams({ url: targetUrl });
    if (referer) params.set('referer', referer);
    if (rootReferer) params.set('root_referer', rootReferer);
    return `/api/media-proxy?${params.toString()}`;
};

const rewritePlaylist = (text, playlistUrl, rootReferer) => {
    const lines = String(text || '').split(/\r?\n/);
    return lines
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            const absolute = new URL(trimmed, playlistUrl).toString();
            return proxiedMediaUrl(absolute, playlistUrl, rootReferer || playlistUrl);
        })
        .join('\n');
};

const buildMediaHeaders = (referer, rangeHeader) => ({
    'User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': referer,
    'Origin': new URL(referer).origin,
    ...(rangeHeader ? { 'Range': rangeHeader } : {})
});

const fetchWithRefererFallbacks = async (targetUrl, referer, rootReferer, rangeHeader) => {
    const candidates = [];
    const pushUnique = (value) => {
        if (!value || !isAbsoluteHttpUrl(value) || candidates.includes(value)) return;
        candidates.push(value);
    };

    pushUnique(rootReferer);
    pushUnique(referer);
    pushUnique(targetUrl);

    let lastResponse = null;
    for (const candidate of candidates) {
        const response = await fetch(targetUrl, { headers: buildMediaHeaders(candidate, rangeHeader) });
        if (response.ok || response.status === 206) {
            return { response, usedReferer: candidate };
        }
        lastResponse = response;
        if (response.status !== 403) break;
    }

    return { response: lastResponse, usedReferer: candidates[0] || targetUrl };
};

app.post('/api/search', async (req, res) => {
    try {
        const { query } = req.body;
        const results = await provider.search(query || '');
        for (const result of results) {
            if (result?.isLive === true) {
                const cached = streamAvailability.get(result.id);
                if (cached?.isLive === false) {
                    clearStreamAvailability(result.id);
                }
            }
        }
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error in /api/search:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/stream-statuses', (_req, res) => {
    res.json({ success: true, data: getAvailabilitySnapshot() });
});

app.post('/api/report-stream-status', (req, res) => {
    try {
        const { id, isLive, reason } = req.body || {};
        setStreamAvailability(id, Boolean(isLive), reason || 'reported');
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/report-stream-status:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/fetchInfo', async (req, res) => {
    try {
        const { id } = req.body;
        console.log('Fetching info for:', id);
        const info = await provider.fetchInfo(id);
        res.json({ success: true, data: info });
    } catch (error) {
        console.error('Error in /api/fetchInfo:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/fetchSources', async (req, res) => {
    try {
        const { eventUrl, embedUrl, background } = req.body;
        const target = eventUrl || embedUrl;
        const isBackground = Boolean(background);
        console.log('Fetching sources for:', target);
        const sources = await provider.fetchSources(target);
        console.log('Got sources:', sources.sources.length);
        if (sources.sources.length > 0) {
            setStreamAvailability(target, true, 'source_available');
        } else if (!isBackground) {
            setStreamAvailability(target, false, sources.error || 'no_sources');
        }
        res.json({ success: true, data: sources });
    } catch (error) {
        console.error('Error in /api/fetchSources:', error);
        if (!req.body?.background) {
            setStreamAvailability(req.body?.eventUrl || req.body?.embedUrl, false, error.message);
        }
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/proxy', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.json({ success: false, error: 'URL required' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT
            }
        });

        const html = await response.text();
        res.json({ success: true, data: html });
    } catch (error) {
        console.error('Error in /api/proxy:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/media-proxy', async (req, res) => {
    try {
        const targetUrl = String(req.query.url || '').trim();
        const referer = String(req.query.referer || '').trim();
        const rootReferer = String(req.query.root_referer || '').trim();

        if (!isAbsoluteHttpUrl(targetUrl)) {
            return res.status(400).send('Invalid target URL');
        }

        const { response, usedReferer } = await fetchWithRefererFallbacks(targetUrl, referer, rootReferer, req.headers.range);

        if (!response || (!response.ok && response.status !== 206)) {
            return res.status(response?.status || 502).send(`Upstream media error: ${response?.status || 502}`);
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('mpegurl') || targetUrl.includes('load-playlist') || targetUrl.includes('.m3u8') || /\/playlist\//i.test(targetUrl)) {
            const body = await response.text();
            const rewritten = rewritePlaylist(body, targetUrl, rootReferer || usedReferer || referer || targetUrl);
            res.status(response.status);
            res.set({
                ...passthroughHeaders(response.headers),
                'Content-Type': 'application/vnd.apple.mpegurl'
            });
            return res.send(rewritten);
        }

        res.status(response.status);
        res.set(passthroughHeaders(response.headers));
        if (!response.body) {
            return res.end();
        }

        for await (const chunk of response.body) {
            res.write(chunk);
        }
        res.end();
    } catch (error) {
        console.error('Error in /api/media-proxy:', error);
        res.status(500).send(error.message);
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`BuffStreams Test Server running on http://localhost:${PORT}`);
    console.log('Check browser console (F12) for debug logs when playing streams');
});



