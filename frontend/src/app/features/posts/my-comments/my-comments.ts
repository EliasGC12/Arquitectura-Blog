import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { CommentService, OwnedComment } from '../comments.service';
import { timeAgo } from '../time-ago';

@Component({
  imports: [RouterLink],
  selector: 'app-my-comments',
  styleUrl: './my-comments.css',
  templateUrl: './my-comments.html',
})
export class MyComments implements OnInit {
  private readonly commentService = inject(CommentService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly comments = signal<OwnedComment[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly timeAgo = timeAgo;

  ngOnInit(): void {
    this.commentService
      .getOwnComments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => this.comments.set(comments),
        error: (error: HttpErrorResponse) => {
          this.errorMessage.set(
            error.status === 403
              ? 'Solo quien publica puede ver los comentarios de sus publicaciones.'
              : 'No se pudieron cargar los comentarios.',
          );
        },
      });
  }
}
