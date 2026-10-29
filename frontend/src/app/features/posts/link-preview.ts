export interface LinkPreview {
  kind: 'youtube' | 'vimeo' | 'link';
  href: string;
  host: string;
  embedUrl: string | null;
}

export function linkPreview(raw: string | null | undefined): LinkPreview | null {
  const value = (raw ?? '').trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const youtubeId = youtubeIdFrom(url);
  if (youtubeId) {
    return {
      kind: 'youtube',
      href: url.href,
      host,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
    };
  }

  const vimeoId = vimeoIdFrom(url);
  if (vimeoId) {
    return {
      kind: 'vimeo',
      href: url.href,
      host,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  return { kind: 'link', href: url.href, host, embedUrl: null };
}

function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    return videoId(url.pathname.split('/').filter(Boolean)[0]);
  }

  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null;
  }

  if (url.pathname === '/watch') {
    return videoId(url.searchParams.get('v'));
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if ((parts[0] === 'embed' || parts[0] === 'shorts') && parts[1]) {
    return videoId(parts[1]);
  }

  return null;
}

function vimeoIdFrom(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') {
    return null;
  }

  const id = url.pathname.split('/').filter(Boolean).pop() ?? '';
  return /^\d+$/.test(id) ? id : null;
}

function videoId(value: string | null | undefined): string | null {
  if (!value || !/^[\w-]{6,}$/.test(value)) {
    return null;
  }
  return value;
}
