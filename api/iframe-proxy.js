const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Referer, Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const targetUrl = String(req.query.url || '').trim();
    const referer = String(req.query.referer || '').trim();

    if (!targetUrl) return res.status(400).send('Missing url param');

    const upstreamHeaders = {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
    if (referer) {
      upstreamHeaders['Referer'] = referer;
      try { upstreamHeaders['Origin'] = new URL(referer).origin; } catch {}
    }

    const resp = await fetch(targetUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(15000)
    });

    let html = await resp.text();
    const base = (() => { try { return new URL(targetUrl).origin; } catch { return ''; } })();

    if (base) {
      html = html.replace(
        /(<(?:img|script|link|source|video|audio|iframe)\b[^>]*?)(src=|href=)(["'])(?!https?:\/\/|\/\/|data:|#|javascript:)/gi,
        '$1$2$3' + base + '/'
      );
    }

    const proxyBase = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const escTargetUrl = encodeURIComponent(targetUrl);

    const xhrOverride = `<script>
var PROXY_BASE='${proxyBase}';
function _shouldProxy(u){
var url=typeof u==='string'?u:'';
if(!url) return false;
return /^https?:\\/\\//i.test(url) && (/\\/playlist\\//i.test(url) || /chatgpt\\.hereisman\\.net/i.test(url));
}
var ro=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){
var url=typeof u==='string'?u:'';
if(_shouldProxy(url)&&url.indexOf(PROXY_BASE)<0){u=PROXY_BASE+'/api/media-proxy?url='+encodeURIComponent(url)+'&referer=${escTargetUrl}&root_referer=${escTargetUrl}'}
return ro.apply(this,arguments)
};
var rf=window.fetch;
window.fetch=function(u,o){
var url=typeof u==='string'?u:'';
if(_shouldProxy(url)&&url.indexOf(PROXY_BASE)<0){u=PROXY_BASE+'/api/media-proxy?url='+encodeURIComponent(url)+'&referer=${escTargetUrl}&root_referer=${escTargetUrl}'}
return rf.call(this,u,o)
};
</script>`;

    const hlsPatch = `<script>
(function(){
var d=document.createDocumentFragment();
var s=document.createElement('script');
s.textContent='if(typeof Hls!==\\"undefined\\"&&Hls.DefaultConfig){Hls.DefaultConfig.liveSyncDuration=45;Hls.DefaultConfig.liveMaxLatencyDuration=90;Hls.DefaultConfig.maxBufferLength=30;Hls.DefaultConfig.maxMaxBufferLength=45;Hls.DefaultConfig.maxBufferSize=72*1000*1000;Hls.DefaultConfig.backBufferLength=30;Hls.DefaultConfig.liveBackBufferLength=18;Hls.DefaultConfig.maxLiveSyncPlaybackRate=1.05;Hls.DefaultConfig.startLevel=0;Hls.DefaultConfig.abrEwmaDefaultEstimate=220000;Hls.DefaultConfig.capLevelToPlayerSize=true;Hls.DefaultConfig.testBandwidth=false;Hls.DefaultConfig.fragLoadingRetryDelay=1200;Hls.DefaultConfig.levelLoadingRetryDelay=1500}';
d.appendChild(s);
document.head.appendChild(d);
})();
</script>`;

    html = html.replace('</head>', xhrOverride + hlsPatch + '</head>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors * 'self'; script-src * 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob: *; style-src * 'unsafe-inline'");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).send(html);
  } catch (error) {
    console.error('iframe-proxy error:', error);
    res.status(502).send('Proxy error: ' + error.message);
  }
};
