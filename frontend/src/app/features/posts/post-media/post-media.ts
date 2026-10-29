import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { MediaImage, MediaUrlPipe } from '../../../shared/media/media';
import { linkPreview } from '../link-preview';
import { Post } from '../posts.service';

@Component({
  imports: [MediaImage, MediaUrlPipe],
  selector: 'app-post-media',
  styleUrl: './post-media.css',
  templateUrl: './post-media.html',
})
export class PostMedia {
  private readonly sanitizer = inject(DomSanitizer);

  readonly post = input.required<Post>();

  protected readonly preview = computed(() => linkPreview(this.post().video_url));

  protected readonly embed = computed<SafeResourceUrl | null>(() => {
    const url = this.preview()?.embedUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
