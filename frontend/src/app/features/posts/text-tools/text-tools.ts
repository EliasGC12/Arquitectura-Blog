import { Component, output } from '@angular/core';

import { TEXT_FONTS, TextAction } from '../rich-text';

@Component({
  selector: 'app-text-tools',
  styleUrl: './text-tools.css',
  templateUrl: './text-tools.html',
})
export class TextTools {
  readonly format = output<TextAction>();

  protected readonly fonts = TEXT_FONTS;
  private fontCss: string = TEXT_FONTS[0].css;
  private color = '#1c1e21';

  protected chooseFont(event: Event): void {
    const label = (event.target as HTMLSelectElement).value;
    const item = this.fonts.find((font) => font.label === label);
    if (!item || item.css === this.fontCss) {
      return;
    }
    this.fontCss = item.css;
    this.emitStyle();
  }

  protected chooseColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    if (color === this.color) {
      return;
    }
    this.color = color;
    this.emitStyle();
  }

  protected mark(tag: 'strong' | 'em'): void {
    this.format.emit({ type: 'mark', tag });
  }

  protected keepSelection(event: Event): void {
    event.preventDefault();
  }

  private emitStyle(): void {
    this.format.emit({ type: 'style', font: this.fontCss, color: this.color });
  }
}
