import { TestBed } from '@angular/core/testing';

import { RichEditor } from './rich-editor';

describe('RichEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichEditor],
    }).compileComponents();
  });

  it('changes font, color, bold and italic without a render loop', () => {
    const fixture = TestBed.createComponent(RichEditor);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const select = root.querySelector('select') as HTMLSelectElement;
    const color = root.querySelector('input[type="color"]') as HTMLInputElement;
    const area = root.querySelector('textarea') as HTMLTextAreaElement;
    const labels = [...select.options].map((option) => option.value);
    expect(labels).toContain('Georgia');
    expect(labels).toContain('Roboto');
    expect(labels).toContain('Open Sans');

    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    select.value = 'Georgia';
    select.dispatchEvent(new Event('change'));
    color.value = '#1b4f9c';
    color.dispatchEvent(new Event('input'));
    (root.querySelector('button') as HTMLButtonElement).click();
    (root.querySelectorAll('button')[1] as HTMLButtonElement).click();
    area.value = 'Patio central';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const html = emitted.at(-1) ?? '';
    expect(html).toContain('font-family: Georgia');
    expect(html).toContain('#1b4f9c');
    expect(html).toContain('font-weight: 700');
    expect(html).toContain('font-style: italic');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
    expect(html).toContain('Patio central');
    expect(area.value).toBe('Patio central');
    expect(emitted.length).toBeLessThan(8);
  });
});
