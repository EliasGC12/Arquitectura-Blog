import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { fontCss } from '../rich-text';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, RouterLink],
  selector: 'app-styled-title',
  styleUrl: './styled-title.css',
  templateUrl: './styled-title.html',
})
export class StyledTitle {
  readonly titulo = input('');
  readonly font = input('');
  readonly color = input('');
  readonly bold = input(false);
  readonly italic = input(false);
  readonly postId = input<number | null>(null);
  readonly level = input<'h1' | 'h2'>('h2');

  protected readonly look = computed(() => {
    const font = this.font().trim();
    const color = this.color().trim();
    const chosen = Boolean(font || color || this.bold() || this.italic());
    if (!chosen) {
      return {};
    }
    const style: Record<string, string> = {
      'font-weight': this.bold() ? '700' : '400',
      'font-style': this.italic() ? 'italic' : 'normal',
    };
    const family = font ? fontCss(font) : '';
    if (family) {
      style['font-family'] = family;
    }
    if (color) {
      style['color'] = color;
    }
    return style;
  });
}
