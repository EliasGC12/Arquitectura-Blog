import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  styleUrl: './card.css',
  templateUrl: './card.html',
})
export class Card {
  readonly title = input.required<string>();
  readonly content = input('');
}
