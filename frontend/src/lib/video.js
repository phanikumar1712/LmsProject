// ── YouTube URL parser ─────────────────────────────────────────────────────────
// Converts any YouTube URL form (watch, share, shorts, bare id) into an embed
// URL so it can be rendered in a plain <iframe>. Returns null for non-YouTube
// URLs (caller should fall back to a generic video player).
export function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    if (url.includes('/embed/')) return url;
    let videoId = '';
    try {
        if (url.includes('youtube.com/watch?v=')) {
            videoId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
            videoId = url.split('shorts/')[1].split('?')[0];
        } else if (url.includes('youtube.com/live/')) {
            videoId = url.split('live/')[1].split('?')[0];
        } else if (url.includes('youtube.com/')) {
            // Generic youtube.com/*/VIDEO_ID — catch embed, live, etc.
            const candidates = url.split('youtube.com/')[1].split('?')[0].split('/');
            const last = candidates[candidates.length - 1];
            if (/^[a-zA-Z0-9_-]{11}$/.test(last)) videoId = last;
        }
        // Bare YouTube video ID (11 alphanumeric chars)
        if (!videoId && /^[a-zA-Z0-9_-]{11}$/.test(url.split('?')[0])) {
            videoId = url.split('?')[0];
        }
    } catch { /* noop */ }
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0` : null;
}
