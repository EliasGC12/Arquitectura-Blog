import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { presentRichHtml } from '../rich-text';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rich-content',
  styleUrl: './rich-content.css',
  templateUrl: './rich-content.html',
})
export class RichContent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly value = input('');

  protected readonly look = computed(() => presentRichHtml(this.value()));
  protected readonly html = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.look().html));
}
