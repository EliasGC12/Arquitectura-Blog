import { Component, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-reject-dialog',
  styleUrl: './reject-dialog.css',
  templateUrl: './reject-dialog.html',
})
export class RejectDialog {
  readonly open = input(false);
  readonly title = input('Rechazar');
  readonly cancelled = output<void>();
  readonly confirmed = output<string>();

  protected readonly reason = signal('');
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.reason.set('');
        this.error.set('');
      }
    });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected confirm(event: Event): void {
    event.preventDefault();
    const message = this.reason().trim();
    if (!message) {
      this.error.set('Escribe el motivo del rechazo.');
      return;
    }
    this.confirmed.emit(message);
  }
}
