import { Provider } from './Provider.js';

class BuffStreams extends Provider {
    constructor() {
        super();
        this.baseUrl = 'https://buffstreams.plus';
        this.homeUrl = `${this.baseUrl}/index7`;
        this.name = 'BuffStreams';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        this.categoryLogos = {
            soccer: '/images/soccer.webp?v3e32',
            f1: '/images/f1.webp?v3e32',
            nfl: '/images/nfl.webp?v3e32',
            nhl: '/images/nhl.webp?v3e32',
            mlb: '/images/mlb.webp?v3e32',
            mma: '/images/ufc.webp?v3e32',
            boxing: '/images/boxing.webp?v3e32',
            nba: '/images/nba.webp?v3e32',
            ncaa: '/images/ncaa.webp?v3e32',
            sports: '/images/mlb.webp?v3e32'
        };
        this.categoryPages = {
            nfl: `${this.baseUrl}/nflstreams2`,
            soccer: `${this.baseUrl}/soccer-live-streams`,
            mma: `${this.baseUrl}/mmastreams2`,
            boxing: `${this.baseUrl}/boxingstreams2`,
            f1: `${this.baseUrl}/f1streams2`,
            nba: `${this.baseUrl}/nbastreams2`,
            nhl: `${this.baseUrl}/nhlstreams2`,
            mlb: `${this.baseUrl}/mlb-live-streams`,
            ncaa: `${this.baseUrl}/ncaastreams`
        };
    }

    buildHeaders(referer) {
        const origin = (() => {
            try { return new URL(referer).origin; } catch { return this.baseUrl; }
        })();
        return { 'User-Agent': this.userAgent, 'Referer': referer, 'Origin': origin };
    }

    toAbsoluteUrl(value, fallbackBase = this.baseUrl) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        try { return new URL(raw, fallbackBase).toString(); } catch { return null; }
    }

    slugToTitle(value) {
        return String(value || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (char) => char.toUpperCase());
    }

    cleanText(value) {
        return String(value || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#039;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    inferType(url, sectionTitle = '') {
        const lower = `${url || ''} ${sectionTitle || ''}`.toLowerCase();
        if (lower.includes('/nba/') || lower.includes('nba')) return 'nba';
        if (lower.includes('/nhl/') || lower.includes('nhl')) return 'nhl';
        if (lower.includes('/mlb/') || lower.includes('baseball') || lower.includes('mlb')) return 'mlb';
        if (lower.includes('/nfl/') || lower.includes('nfl')) return 'nfl';
        if (lower.includes('/boxing/') || lower.includes('boxing')) return 'boxing';
        if (lower.includes('/mma/') || lower.includes('mma') || lower.includes('ufc')) return 'mma';
        if (lower.includes('/soccer') || lower.includes('/football') || lower.includes('soccer') || lower.includes('fa cup') || lower.includes('premier league') || lower.includes('laliga') || lower.includes('serie a')) return 'soccer';
        if (lower.includes('/f1/') || lower.includes('formula 1') || lower.includes('f1') || lower.includes('nascar') || lower.includes('indycar') || lower.includes('wwe')) return 'f1';
        if (lower.includes('/ncaa/') || lower.includes('/cfb') || lower.includes('ncaa')) return 'ncaa';
        return 'sports';
    }

    getCategoryLogo(type) {
        const raw = this.categoryLogos[type] || this.categoryLogos.sports;
        return this.toAbsoluteUrl(raw, this.baseUrl);
    }

    inferLiveState(title, statusText, sectionTitle) {
        const statusHaystack = `${statusText || ''} ${title || ''}`.toLowerCase();
        if (/\bin progress\b|\blive\b|\b1st half\b|\b2nd half\b|\bhalftime\b|\bquarter\b|\bq[1-4]\b|\bperiod\b|\bovertime\b|\bot\极\binnings?\b|\btop \d+(st|nd|rd|th)?\b|\bbottom \d+(st|nd|rd|th)?\b|\bpractice\b|\bqualifying\b|\bsprint\b|\bfp\d*\b|\bfree practice\b|\bsprint shootout\b|\bwarm.?up\b|\bpre.?race\b|\bpost.?race\b|\bsession\b/i.test(statusHaystack)) return true;

        const scheduleHaystack = `${statusText || ''}`.toLowerCase();
        if (/from now|tomorrow|today at|am et|pm et|upcoming/.test(scheduleHaystack)) return false;

        const fullHaystack = `${title || ''} ${statusText || ''} ${sectionTitle || ''}`.toLowerCase();
        return /\bin progress\b|\blive\b|\b1st half\b|\b2nd half\b|\bhalftime\b|\bquarter\b|\bq[1-4]\b|\bperiod\b|\bovertime\b|\bot\b|\binnings?\b|\btop \d+(st|nd|rd|th)?\b|\bbottom \d+(st|nd|rd|th)?\b|\bpractice\b|\bqualifying\b|\bsprint\b|\bfp\d*\b|\bfree practice\b|\bsprint shootout\b|\b极warm.?up\b|\bpre.?race\b|\bpost.?race\b|\bsession\b/i.test(fullHaystack);
    }

    parseCompetitionItem(itemHtml, fallbackImage, sectionTitle) {
        const hrefMatch = itemHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
        const url = this.toAbsoluteUrl(hrefMatch?.[1], this.baseUrl);
        if (!url) return null;

        const anchorHtml = itemHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || itemHtml;
        const type = this.inferType(url, sectionTitle);

        const compactTitle = this.cleanText(anchorHtml.match(/<div[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
        const compactMeta = this.cleanText(anchorHtml.match(/<small[^>]*>([\s\S]*?)<\/small>/i)?.[1] || '');

        if (compactTitle) {
            return {
                id: url,
                title: compactTitle,
                url,
                type,
                image: fallbackImage || this.getCategoryLogo(type),
                categoryImage: this.getCategoryLogo(type),
                statusText: compactMeta,
                isLive: this.inferLiveState(compactTitle, compactMeta, sectionTitle)
            };
        }

        const nameMatches = [...anchorHtml.matchAll(/<span[^>]*class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
            .map((match) => this.cleanText(match[1]))
            .filter(Boolean);
        const statusMatch = anchorHtml.match(/<(?:time|span)[^>]*class=["'][^"']*competition-cell-status[^"']*["'][^>]*>([\s\S]*?)<\/(?:time|span)>/i);
        const status = this.cleanText(statusMatch?.[1] || '');
        const sideA = nameMatches[0] || '';
        const sideB = nameMatches[1] || '';
        const title = [sideA, status, sideB].filter(Boolean).join(' ').trim() || this.slugToTitle(url);

        return {
            id: url,
            title,
            url,
            type,
            image: fallbackImage || this.getCategoryLogo(type),
            categoryImage: this.getCategoryLogo(type),
            statusText: status,
            isLive: this.inferLiveState(title, status, sectionTitle)
        };
    }

    parseCompetitionBlock(blockHtml, fallbackImage, sectionTitle) {
        const streams = [];
        const itemMatches = [...blockHtml.matchAll(/<li\b[\s\S]*?<\/li>/gi)];
        for (const match of itemMatches) {
            const parsed = this.parseCompetitionItem(match[0], fallbackImage, sectionTitle);
            if (parsed) streams.push(parsed);
        }
        return streams;
    }

    parseStreamsFromHTML(html) {
        const sections = [];
        const seen = new Set();
        const tournamentRegex = /<div class="top-tournament[^"]*">([\s\S]*?)<ul class="competitions">([\s\S]*?)<\/ul>/gi;
        let match;
        while ((match = tournamentRegex.exec(html)) !== null) {
            const headingBlock = match[1] || '';
            const listBlock = match[2] || '';
            const imageMatch = headingBlock.match(/<img[^>]+src=["']([^"']+)["']/i);
            const titleMatch = headingBlock.match(/<h2[^>]*class="league-name[^>]*>([\s\S]*?)<\/h2>/i);
            const sectionImage = this.toAbsoluteUrl(imageMatch?.[1], this.baseUrl);
            const sectionTitle = this.cleanText(titleMatch?.[1] || 'Live Streams');
            const entries = this.parseCompetitionBlock(listBlock, sectionImage, sectionTitle);
            for (const entry of entries) {
                if (seen.has(entry.url)) continue;
                seen.add(entry.url);
                sections.push({ ...entry, sectionTitle, tournamentImage: sectionImage });
            }
        }
        return sections;
    }

    mergeStreams(streamGroups) {
        const merged = [];
        const seen = new Set();
        for (const group of streamGroups) {
            for (const stream of group) {
                const key = stream.url || stream.id;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                merged.push(stream);
            }
        }
        return merged;
    }

    resolveSearchTarget(query) {
        const raw = String(query || '').trim().toLowerCase();
        if (!raw || raw === 'all') return { url: this.homeUrl, mode: 'all' };
        const categoryKey = raw.replace(/^category:/, '');
        if (this.categoryPages[categoryKey]) return { url: this.categoryPages[categoryKey], mode: 'category', categoryKey };
        return { url: this.homeUrl, mode: 'search', raw };
    }

    async fetchCategoryStreams(url) {
        const response = await fetch(url, { headers: this.buildHeaders(url) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        return this.parseStreamsFromHTML(html);
    }

    async fetchAllStreams() {
        const urls = [this.homeUrl, ...Object.values(this.categoryPages)];
        const results = await Promise.allSettled(urls.map((url) => this.fetchCategoryStreams(url)));
        const fulfilled = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        return this.mergeStreams(fulfilled);
    }

    async search(query) {
        try {
            const target = this.resolveSearchTarget(query);
            if (target.mode === 'all') return await this.fetchAllStreams();
            const streams = await this.fetchCategoryStreams(target.url);
            if (target.mode === 'category') return streams;
            return streams.filter((stream) => `${stream.title} ${stream.statusText || ''} ${stream.type} ${stream.sectionTitle || ''}`.toLowerCase().includes(target.raw));
        } catch (error) {
            console.error('Error in BuffStreams search:', error);
            return [];
        }
    }

    extractTitle(html, fallbackUrl) {
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        if (titleMatch?.[1]) return titleMatch[1].replace(/\s*-\s*Buffstreams\s*$/i, '').trim();
        try {
            const parts = new URL(fallbackUrl).pathname.split('/').filter(Boolean);
            return this.slugToTitle(parts[parts.length - 2] || fallbackUrl);
        } catch { return fallbackUrl; }
    }

    extractEmbedUrl(html, pageUrl) {
        const iframeMatch = html.match(/<iframe[^>]+id=["']cx-iframe["'][^>]+src=["']([^"']+)["']/i) || html.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (!iframeMatch?.[1]) return null;
        return this.toAbsoluteUrl(iframeMatch[1], pageUrl);
    }

    extractSessionCards(html) {
        const listMatch = html.match(/<ul[^>]*class=["']under-card-events["'][^>]*>([\s\S]*?)<\/ul>/i);
        if (!listMatch) return [];
        const listHtml = listMatch[1];
        const sessions = [];
        const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        for (const itemMatch of listHtml.matchAll(itemRegex)) {
            const item = itemMatch[1];
            const status = (item.match(/<div[^>]*style=["'][^"']*font-weight:\s*500[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').trim();
            const name = (item.match(/<div[^>]*class=["']name-under-card-name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').trim();
            const when = (item.match(/<div[^>]*style=["'][^"']*color:\s*#747171[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').trim();
            if (name) {
                sessions.push({ status, name, when });
            }
        }
        return sessions;
    }

    extractEventDetails(html, pageUrl) {
        const leagueMatch = html.match(/<h2[^>]*class=["']title["'][^>]*>([\s\S]*?)<div>/i);
        const dateMatch = html.match(/fa-calendar[\s\S]*?<\/i>\s*([^<]+)</i);
        const statusMatch = html.match(/<div[^>]*class=["']event-status["'][^>]*>([\s\S]*?)<\/div>/i);
        const scoreMatches = [...html.matchAll(/<span[^>]*class=["']score["'][^>]*>([\s\S]*?)<\/span>/gi)].map((match) => this.cleanText(match[1])).filter(Boolean);
        const teamMatches = [...html.matchAll(/<div[^>]*class=["']event-team["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'][\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<\/div>/gi)];
        const titleMatch = html.match(/<h1[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/h1>/i);
        const teams = teamMatches.slice(0, 2).map((match, index) => ({
            name: this.cleanText(match[3] || match[2] || ''),
            logo: this.toAbsoluteUrl(match[1], pageUrl),
            score: scoreMatches[index] || ''
        }));
        return {
            title: this.cleanText(titleMatch?.[1] || ''),
            league: this.cleanText(leagueMatch?.[1] || ''),
            date: this.cleanText(dateMatch?.[1] || ''),
            status: this.cleanText(statusMatch?.[1] || ''),
            teams,
            scores: scoreMatches
        };
    }

    extractHlsFromEmbed(html) {
        const decodeIfUrl = (value) => {
            try {
                const decoded = Buffer.from(String(value || '').trim(), 'base64').toString('utf8').trim();
                if (/^https?:\/\//i.test(decoded)) return decoded;
            } catch {}
            return null;
        };

        const directAtobMatch = html.match(/source\s*:\s*window\.atob\(\s*['\"]([^'\"]+)['\"]\s*\)/i);
        if (directAtobMatch?.[1]) {
            const decoded = decodeIfUrl(directAtobMatch[1]);
            if (decoded) return decoded;
        }

        for (const match of html.matchAll(/window\.atob\(\s*['\"]([^'\"]+)['\"]\s*\)/gi)) {
            const decoded = decodeIfUrl(match[1]);
            if (decoded) return decoded;
        }

        const directSourceMatch = html.match(/source\s*:\s*['\"]([^'\"]+)['\"]/i);
        if (directSourceMatch?.[1] && /^https?:\/\//i.test(directSourceMatch[1])) return directSourceMatch[1];

        const playlistMatch = html.match(/https?:\/\/[^'\"\s]+(?:load-playlist|\.m3u8|\/playlist\/[^'\"\s]+)/i);
        if (playlistMatch?.[0]) return playlistMatch[0];

        for (const match of html.matchAll(/['\"](https?:\/\/[^'\"]+)['\"]/gi)) {
            if (/load-playlist|\.m3u8|\/playlist\//i.test(match[1])) return match[1];
        }

        return null;
    }

    parseM3uAttributeList(value) {
        const attributes = {};
        const source = String(value || '');
        const regex = /([A-Z0-9-]+)=(("[^"]*")|[^,]*)/gi;
        let match;
        while ((match = regex.exec(source)) !== null) {
            const key = String(match[1] || '').toUpperCase();
            let raw = String(match[2] || '').trim();
            if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
            attributes[key] = raw;
        }
        return attributes;
    }

    parseHlsVariantSources(manifestText, manifestUrl, refererHeaders) {
        const lines = String(manifestText || '').split(/\r?\n/);
        const variants = [];
        const seen = new Set();

        for (let i = 0; i < lines.length; i += 1) {
            const line = String(lines[i] || '').trim();
            if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;

            const info = line.slice('#EXT-X-STREAM-INF:'.length);
            let streamUrl = '';
            for (let j = i + 1; j < lines.length; j += 1) {
                const candidate = String(lines[j] || '').trim();
                if (!candidate) continue;
                if (candidate.startsWith('#')) continue;
                streamUrl = this.toAbsoluteUrl(candidate, manifestUrl) || '';
                break;
            }
            if (!streamUrl || seen.has(streamUrl)) continue;

            const resolution = info.match(/RESOLUTION=\s*(\d+)x(\d+)/i);
            const bandwidth = info.match(/(?:AVERAGE-BANDWIDTH|BANDWIDTH)=\s*(\d+)/i);
            const qualityLabel = resolution?.[2]
                ? `${resolution[2]}p`
                : (bandwidth?.[1] ? `${Math.round(Number(bandwidth[1]) / 1000)}k` : 'auto');

            seen.add(streamUrl);
            variants.push({
                url: streamUrl,
                quality: qualityLabel,
                isM3U8: true,
                isDirect: true,
                headers: refererHeaders
            });
        }

        return variants;
    }

    parseHlsSubtitleSources(manifestText, manifestUrl, refererHeaders) {
        const subtitles = [];
        const seen = new Set();
        const lines = String(manifestText || '').split(/\r?\n/);

        for (const rawLine of lines) {
            const line = String(rawLine || '').trim();
            if (!line.startsWith('#EXT-X-MEDIA:')) continue;
            const attrs = this.parseM3uAttributeList(line.slice('#EXT-X-MEDIA:'.length));
            const type = String(attrs.TYPE || '').toUpperCase();
            
            // Handle subtitle files (TYPE=SUBTITLES with URI)
            if (type === 'SUBTITLES') {
                const trackUrl = this.toAbsoluteUrl(attrs.URI, manifestUrl);
                if (!trackUrl || seen.has(trackUrl)) continue;

                const lang = String(attrs.LANGUAGE || '').trim();
                const name = String(attrs.NAME || '').trim();
                const label = name || lang || 'Subtitles';
                const format = /\.vtt($|\?)/i.test(trackUrl) ? 'vtt' : 'm3u8';

                seen.add(trackUrl);
                subtitles.push({
                    url: trackUrl,
                    lang,
                    label,
                    format,
                    headers: refererHeaders
                });
            }
            // Handle closed captions (TYPE=CLOSED-CAPTIONS with INSTREAM-ID)
            // These are typically embedded in the video stream and HLS.js will expose them
            // We create placeholder entries so the frontend knows they're available
            else if (type === 'CLOSED-CAPTIONS') {
                const instreamId = String(attrs['INSTREAM-ID'] || '').trim();
                if (instreamId) {
                    const lang = String(attrs.LANGUAGE || '').trim();
                    const name = String(attrs.NAME || '').trim();
                    const label = name || lang || instreamId;
                    
                    if (!seen.has(instreamId)) {
                        seen.add(instreamId);
                        subtitles.push({
                            url: instreamId,
                            lang,
                            label,
                            format: 'closed-caption',
                            isBuiltIn: true,
                            headers: refererHeaders
                        });
                    }
                }
            }
        }

        return subtitles;
    }

    async extractManifestMedia(hlsUrl, refererHeaders) {
        try {
            const response = await fetch(hlsUrl, { headers: refererHeaders });
            if (!response.ok) return { variants: [], subtitles: [] };
            const contentType = String(response.headers.get('content-type') || '').toLowerCase();
            const manifestText = await response.text();
            if (!/mpegurl|m3u8/.test(contentType) && !/^#EXTM3U/i.test(manifestText.trim())) {
                return { variants: [], subtitles: [] };
            }

            const variants = /#EXT-X-STREAM-INF:/i.test(manifestText)
                ? this.parseHlsVariantSources(manifestText, hlsUrl, refererHeaders)
                : [];
            const subtitles = this.parseHlsSubtitleSources(manifestText, hlsUrl, refererHeaders);

            return { variants, subtitles };
        } catch {
            return { variants: [], subtitles: [] };
        }
    }

    async fetchInfo(id) {
        try {
            const url = this.toAbsoluteUrl(id, this.baseUrl);
            if (!url) throw new Error(`Invalid stream URL: ${id}`);
            const response = await fetch(url, { headers: this.buildHeaders(this.homeUrl) });
            if (!response.ok) throw new Error(`Could not fetch stream info for ${id}`);
            const html = await response.text();
            const embedUrl = this.extractEmbedUrl(html, url);
            const details = this.extractEventDetails(html, url);
            const sessions = this.extractSessionCards(html);
            const activeSession = (() => {
                if (!sessions.length) return null;
                const liveMatch = sessions.find((s) => /live|in progress|started/i.test(s.status));
                if (liveMatch) return liveMatch;
                const nextMatch = sessions.find((s) => !/finished/i.test(s.status));
                if (nextMatch) return nextMatch;
                return sessions[sessions.length - 1];
            })();
            return {
                id: url,
                title: details.title || this.extractTitle(html, url),
                url,
                embedUrl,
                league: details.league,
                eventDate: details.date,
                status: details.status,
                teams: details.teams,
                scores: details.scores,
                sessions,
                activeSession
            };
        } catch (error) {
            console.error('Error in BuffStreams fetchInfo:', error);
            throw error;
        }
    }

    async fetchSources(eventUrl) {
        try {
            const normalizedEventUrl = this.toAbsoluteUrl(eventUrl, this.baseUrl);
            if (!normalizedEventUrl) throw new Error(`Invalid event URL: ${eventUrl}`);
            const eventResponse = await fetch(normalizedEventUrl, { headers: this.buildHeaders(this.homeUrl) });
            if (!eventResponse.ok) throw new Error(`Failed to fetch event page: ${eventResponse.status}`);
            const eventHtml = await eventResponse.text();
            const embedUrl = this.extractEmbedUrl(eventHtml, normalizedEventUrl);
            if (!embedUrl) throw new Error('No stream iframe found on the event page');
            const embedResponse = await fetch(embedUrl, { headers: this.buildHeaders(normalizedEventUrl) });
            if (!embedResponse.ok) throw new Error(`Failed to fetch embed page: ${embedResponse.status}`);
            const embedHtml = await embedResponse.text();
            const hlsUrl = this.extractHlsFromEmbed(embedHtml);
            if (!hlsUrl) throw new Error('No direct HLS URL found in embed');

            const sourceHeaders = { 'Referer': embedUrl, 'Origin': new URL(embedUrl).origin, 'User-Agent': this.userAgent };
            const manifestMedia = await this.extractManifestMedia(hlsUrl, sourceHeaders);
            const variantSources = Array.isArray(manifestMedia.variants) ? manifestMedia.variants : [];
            const subtitleSources = Array.isArray(manifestMedia.subtitles) ? manifestMedia.subtitles : [];
            const baseSource = { url: hlsUrl, quality: 'auto', isM3U8: true, isDirect: true, headers: sourceHeaders };

            const allSources = variantSources.length
                ? [baseSource, ...variantSources]
                : [baseSource];

            return {
                sources: allSources,
                subtitles: subtitleSources,
                headers: sourceHeaders,
                embedUrl
            };
        } catch (error) {
            console.error('Error in BuffStreams fetchSources:', error);
            return { sources: [], subtitles: [], headers: {}, error: error.message };
        }
    }
}

export default BuffStreams;
