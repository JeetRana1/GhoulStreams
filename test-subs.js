import Stream from './Stream.js';

const provider = new Stream();
try {
  const streams = await provider.search('ufc');
  const first = streams.find(s => s && s.url);
  if (!first) { console.log('NO_STREAM'); process.exit(0); }
  
  const info = await provider.fetchInfo(first.url);
  console.log('Event:', info.title);
  
  const src = await provider.fetchSources(info.url);
  const fsrc = src.sources.find(s => s && s.url);
  if (!fsrc) { console.log('NO_SOURCE'); process.exit(0); }
  
  console.log('Fetching manifest from:', fsrc.url.substring(0, 80) + '...');
  const res = await fetch(fsrc.url, { headers: fsrc.headers || {} });
  const manifest = await res.text();
  
  console.log('\n=== LOOKING FOR SUBTITLE/MEDIA TAGS ===');
  const lines = manifest.split(/\r?\n/);
  let foundAny = false;
  
  lines.forEach((line, i) => {
    if (line.match(/#EXT-X-MEDIA/i) || line.match(/SUBTITLE/i) || line.match(/CLOSED/i)) {
      console.log(`Line ${i}: ${line}`);
      foundAny = true;
    }
  });
  
  if (!foundAny) {
    console.log('No MEDIA/SUBTITLE/CLOSED caption lines found');
  }
  
  console.log('\n=== Extracted by backend ===');
  console.log('Subtitles array length:', src.subtitles ? src.subtitles.length : 0);
  if (src.subtitles && src.subtitles.length > 0) {
    console.log('Subtitles:', JSON.stringify(src.subtitles, null, 2));
  }
} catch(e) {
  console.error('Error:', e.message);
  process.exit(1);
}
