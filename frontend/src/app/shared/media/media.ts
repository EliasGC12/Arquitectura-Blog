import { Directive, ElementRef, inject, Pipe, PipeTransform } from '@angular/core';

import { apiBase } from '../../core/api-url';

const AVATAR_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e7eef8"/><circle cx="32" cy="26" r="10" fill="#8ea3bf"/><path d="M12 56c2.5-11 10-16 20-16s17.5 5 20 16" fill="#8ea3bf"/></svg>',
  );

export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith('blob:') || value.startsWith('data:')) {
    return value;
  }

  const origin = new URL(apiBase()).origin;
  if (value.startsWith('/')) {
    return `${origin}${value}`;
  }

  try {
    const parsed = new URL(value);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (local) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.href;
  } catch {
    return `${origin}/${value.replace(/^\//, '')}`;
  }
}

@Pipe({ name: 'mediaUrl' })
export class MediaUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    return mediaUrl(value);
  }
}

@Directive({
  selector: 'img[appMedia]',
  host: {
    '(error)': 'onError()',
  },
})
export class MediaImage {
  private readonly image = inject(ElementRef<HTMLImageElement>);
  private usedFallback = false;

  onError(): void {
    if (this.usedFallback) {
      return;
    }
    this.usedFallback = true;
    this.image.nativeElement.src = AVATAR_FALLBACK;
  }
}
