import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OwnedComment, CommentService } from '../comments.service';
import { PostMedia } from '../post-media/post-media';
import { Category, Post, PostsService, Tag, toPostData } from '../posts.service';
import { RichContent } from '../rich-content/rich-content';
import { StyledTitle } from '../styled-title/styled-title';
import { RichEditor } from '../rich-editor/rich-editor';
import { RejectDialog } from '../../../shared/components/reject-dialog/reject-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, RouterLink, PostMedia, RichEditor, RichContent, RejectDialog, StyledTitle],
  selector: 'app-revision',
  styleUrl: './revision.css',
  templateUrl: './revision.html',
})
export class Revision implements OnInit, OnDestroy {
  private readonly postsService = inject(PostsService);
  private readonly commentService = inject(CommentService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<Post[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly tags = signal<Tag[]>([]);
  protected readonly editingId = signal<number | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);
  protected readonly nextPage = signal<string | null>(null);
  protected readonly previousPage = signal<string | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly pendingComments = signal<OwnedComment[]>([]);
  protected readonly moderatingCommentId = signal<number | null>(null);
  protected readonly rejectRequest = signal<
    { kind: 'post'; post: Post } | { kind: 'comment'; comment: OwnedComment } | null
  >(null);
  private imageFile: File | null = null;
  private objectPreview: string | null = null;
  private currentPageUrl = '';

  protected readonly form = this.formBuilder.group({
    titulo: this.formBuilder.nonNullable.control('', Validators.required),
    contenido: this.formBuilder.nonNullable.control('', Validators.required),
    estado: this.formBuilder.nonNullable.control<Post['estado']>('PENDIENTE_REVISION'),
    category_id: this.formBuilder.control<number | null>(null),
    category_name: this.formBuilder.nonNullable.control(''),
    tag_ids: this.formBuilder.nonNullable.control<number[]>([]),
    tag_names: this.formBuilder.nonNullable.control(''),
    video_url: this.formBuilder.nonNullable.control(''),
  });

  protected readonly estados: Post['estado'][] = [
    'BORRADOR',
    'PENDIENTE_REVISION',
    'PUBLICADO',
    'ARCHIVADO',
  ];

  ngOnDestroy(): void {
    this.clearPreview();
  }

  ngOnInit(): void {
    this.currentPageUrl = this.postsService.pendingReviewUrl();
    this.loadTaxonomy();
    this.loadPosts();
    this.loadPendingComments();
  }

  protected startEdit(post: Post): void {
    this.editingId.set(post.id);
    this.form.setValue({
      titulo: post.titulo,
      contenido: post.contenido,
      estado: post.estado,
      category_id: post.category?.id ?? null,
      category_name: '',
      tag_ids: post.tags.map((tag) => tag.id),
      tag_names: '',
      video_url: post.video_url ?? '',
    });
    this.imageFile = null;
    this.setPreview(post.image, false);
    this.errorMessage.set('');
  }

  protected onRich(html: string): void {
    const control = this.form.controls.contenido;
    if (control.value === html) {
      return;
    }
    control.setValue(html);
  }

  protected onImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile = file;
    if (file) {
      this.setPreview(URL.createObjectURL(file), true);
    }
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.form.reset({
      titulo: '',
      contenido: '',
      estado: 'PENDIENTE_REVISION',
      category_id: null,
      category_name: '',
      tag_ids: [],
      tag_names: '',
      video_url: '',
    });
    this.imageFile = null;
    this.setPreview(null, false);
  }

  protected save(): void {
    const editingId = this.editingId();
    if (editingId === null || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      if (this.form.invalid) {
        this.errorMessage.set('Completa el título y el contenido.');
      }
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    this.postsService
      .updatePost(editingId, toPostData(this.form.getRawValue()), this.imageFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.cancel();
          this.loadTaxonomy();
          this.loadPosts();
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.readError(error));
        },
      });
  }

  protected approveComment(comment: OwnedComment): void {
    if (this.moderatingCommentId() !== null) {
      return;
    }
    this.moderatingCommentId.set(comment.id);
    this.errorMessage.set('');
    this.commentService
      .approveComment(comment.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.moderatingCommentId.set(null);
          this.pendingComments.update((items) => items.filter((item) => item.id !== comment.id));
        },
        error: () => {
          this.moderatingCommentId.set(null);
          this.errorMessage.set('No se pudo aprobar el comentario.');
        },
      });
  }

  protected askRejectComment(comment: OwnedComment): void {
    this.rejectRequest.set({ kind: 'comment', comment });
  }

  protected confirmReject(message: string): void {
    const request = this.rejectRequest();
    this.rejectRequest.set(null);
    if (!request) {
      return;
    }
    if (request.kind === 'post') {
      this.sendPostReject(request.post, message);
      return;
    }
    this.sendCommentReject(request.comment, message);
  }

  private sendCommentReject(comment: OwnedComment, message: string): void {
    if (this.moderatingCommentId() !== null) {
      return;
    }
    this.moderatingCommentId.set(comment.id);
    this.errorMessage.set('');
    this.commentService
      .rejectComment(comment.id, message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.moderatingCommentId.set(null);
          this.pendingComments.update((items) => items.filter((item) => item.id !== comment.id));
        },
        error: () => {
          this.moderatingCommentId.set(null);
          this.errorMessage.set('No se pudo rechazar el comentario.');
        },
      });
  }

  protected publish(post: Post): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    this.postsService
      .approvePost(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          if (this.editingId() === post.id) {
            this.cancel();
          }
          this.loadPosts();
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.readError(error));
        },
      });
  }

  protected askRejectPost(post: Post): void {
    this.rejectRequest.set({ kind: 'post', post });
  }

  private sendPostReject(post: Post, message: string): void {
    if (this.submitting()) {
      return;
    }
    this.errorMessage.set('');
    this.submitting.set(true);
    this.postsService
      .rejectPost(post.id, message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          if (this.editingId() === post.id) {
            this.cancel();
          }
          this.loadPosts();
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.readError(error));
        },
      });
  }

  protected goToPage(url: string | null): void {
    if (!url) {
      return;
    }
    this.currentPageUrl = url;
    this.loadPosts();
  }

  private setPreview(url: string | null, owned: boolean): void {
    this.clearPreview();
    if (owned && url) {
      this.objectPreview = url;
    }
    this.imagePreview.set(url);
  }

  private clearPreview(): void {
    if (this.objectPreview) {
      URL.revokeObjectURL(this.objectPreview);
      this.objectPreview = null;
    }
  }

  private loadTaxonomy(): void {
    this.postsService
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (categories) => this.categories.set(categories) });
    this.postsService
      .getTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (tags) => this.tags.set(tags) });
  }

  private loadPendingComments(): void {
    this.commentService
      .getPending()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => this.pendingComments.set(comments),
        error: () => this.errorMessage.set('No se pudieron cargar los comentarios pendientes.'),
      });
  }

  private loadPosts(): void {
    this.postsService
      .getPosts(this.currentPageUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.nextPage.set(response.next);
          this.previousPage.set(response.previous);
          this.posts.set(response.results);
        },
        error: (error: HttpErrorResponse) => {
          this.posts.set([]);
          this.errorMessage.set(
            error.status === 403
              ? 'No tienes permiso para ver la bandeja de revisión.'
              : 'No se pudieron cargar las publicaciones pendientes.',
          );
        },
      });
  }

  private readError(error: HttpErrorResponse): string {
    if (error.status === 403) {
      return 'No tienes permiso para moderar esta publicación.';
    }
    if (error.status === 400) {
      const estado = error.error?.estado;
      if (Array.isArray(estado) && estado.length > 0) {
        return String(estado[0]);
      }
      const categoryName = error.error?.category_name;
      if (Array.isArray(categoryName) && categoryName.length > 0) {
        return String(categoryName[0]);
      }
      return 'Revisa los datos de la publicación.';
    }
    return 'No se pudo actualizar la publicación.';
  }
}
