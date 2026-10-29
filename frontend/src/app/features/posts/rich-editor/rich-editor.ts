import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { TEXT_FONTS, repairQuotedFonts, styleAttribute } from '../rich-text';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-rich-editor',
  styleUrl: './rich-editor.css',
  templateUrl: './rich-editor.html',
})
export class RichEditor implements AfterViewInit {
  readonly value = input('');
  readonly placeholder = input('Escribir algo...');
  readonly resetKey = input<string | number | null>(null);
  readonly valueChange = output<string>();

  private readonly area = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');
  private readonly fontSelect = viewChild.required<ElementRef<HTMLSelectElement>>('fontSelect');
  private readonly colorInput = viewChild.required<ElementRef<HTMLInputElement>>('colorInput');

  protected readonly fonts = TEXT_FONTS;
  protected readonly selectedFont = signal<string>(TEXT_FONTS[0].label);
  protected readonly selectedColor = signal('#1c1e21');
  protected readonly bold = signal(false);
  protected readonly italic = signal(false);
  protected readonly fontCss = computed(
    () => TEXT_FONTS.find((item) => item.label === this.selectedFont())?.css ?? TEXT_FONTS[0].css,
  );

  private text = '';
  private seenKey: string | number | null | undefined = undefined;
  private ready = false;

  constructor() {
    effect(() => {
      const key = this.resetKey();
      if (!this.ready || key === this.seenKey) {
        return;
      }
      this.seenKey = key;
      untracked(() => this.load(this.value()));
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.seenKey = this.resetKey();
    this.load(this.value());
  }

  protected onText(event: Event): void {
    this.text = (event.target as HTMLTextAreaElement).value;
    this.emitStyled();
  }

  protected onFont(event: Event): void {
    this.selectedFont.set((event.target as HTMLSelectElement).value);
    this.emitStyled();
  }

  protected onColor(event: Event): void {
    this.selectedColor.set((event.target as HTMLInputElement).value);
    this.emitStyled();
  }

  protected toggleBold(): void {
    this.bold.update((value) => !value);
    this.emitStyled();
  }

  protected toggleItalic(): void {
    this.italic.update((value) => !value);
    this.emitStyled();
  }

  private load(html: string): void {
    const document = new DOMParser().parseFromString(repairQuotedFonts(html || ''), 'text/html');
    this.bold.set(Boolean(document.querySelector('strong, b')));
    this.italic.set(Boolean(document.querySelector('em, i')));
    const styled = document.querySelector('span[style], font');
    const style = styled?.getAttribute('style') ?? '';
    const family = style.match(/font-family\s*:\s*([^;]+)/i)?.[1] ?? styled?.getAttribute('face') ?? '';
    const match = TEXT_FONTS.find((font) => family.toLowerCase().includes(font.label.toLowerCase()));
    this.selectedFont.set(match?.label ?? TEXT_FONTS[0].label);
    const color = style.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6})/i)?.[1];
    this.selectedColor.set(color?.toLowerCase() ?? '#1c1e21');
    if (/font-weight\s*:\s*(bold|700)/i.test(style)) {
      this.bold.set(true);
    }
    if (/font-style\s*:\s*italic/i.test(style)) {
      this.italic.set(true);
    }
    this.text = (document.body.textContent ?? '').replaceAll('\u200b', '');
    this.area().nativeElement.value = this.text;
    this.fontSelect().nativeElement.value = this.selectedFont();
    this.colorInput().nativeElement.value = this.selectedColor();
  }

  private emitStyled(): void {
    this.valueChange.emit(this.toHtml(this.text));
  }

  private toHtml(text: string): string {
    const source = text.replaceAll('\u200b', '');
    if (!source.trim()) {
      return '';
    }
    const escaped = source
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\n', '<br>');
    const marked = this.bold() ? `<strong>${escaped}</strong>` : escaped;
    const body = this.italic() ? `<em>${marked}</em>` : marked;
    const weight = this.bold() ? '700' : '400';
    const slant = this.italic() ? 'italic' : 'normal';
    const style = `${styleAttribute(this.fontCss(), this.selectedColor())}; font-weight: ${weight}; font-style: ${slant}`.replaceAll(
      '"',
      "'",
    );
    return `<span style="${style}">${body}</span>`;
  }
}
