import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Api } from '../../../core/services/api';
import { TokenStorage } from '../../../core/services/token-storage';
import { Comment, CommentService } from '../comments.service';
import { linkPreview } from '../link-preview';
import { PostMedia } from '../post-media/post-media';
import { Category, Post, PostsService, Tag, toPostData } from '../posts.service';
import { CommentThread } from '../comment-thread/comment-thread';
import { RichContent } from '../rich-content/rich-content';
import { RichEditor } from '../rich-editor/rich-editor';
import { TEXT_FONTS } from '../rich-text';
import { StyledTitle } from '../styled-title/styled-title';
import { timeAgo } from '../time-ago';
import { RejectDialog } from '../../../shared/components/reject-dialog/reject-dialog';
import { MediaImage, MediaUrlPipe } from '../../../shared/media/media';
import { roleLabel } from '../../../shared/roles';

type ComposerTab = 'estado' | 'foto' | 'enlace' | 'video';

interface PerfilUsuario {
  username: string;
  rol: string;
  profile_picture: string | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PostMedia,
    RichEditor,
    RichContent,
    RejectDialog,
    StyledTitle,
    CommentThread,
    MediaImage,
    MediaUrlPipe,
  ],
  selector: 'app-post-list',
  styleUrl: './post-list.css',
  templateUrl: './post-list.html',
})
export class PostList implements OnInit, OnDestroy {
  private readonly postsService = inject(PostsService);
  private readonly commentService = inject(CommentService);
  private readonly api = inject(Api);
  private readonly tokenStorage = inject(TokenStorage);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<Post[]>([]);
  protected readonly currentUser = signal<PerfilUsuario | null>(null);
  protected readonly authenticated = signal(false);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly submitting = signal(false);
  protected readonly nextPage = signal<string | null>(null);
  protected readonly previousPage = signal<string | null>(null);
  protected readonly commentDrafts = signal<Record<number, string>>({});
  protected readonly commentErrors = signal<Record<number, string>>({});
  protected readonly commentNotes = signal<Record<number, string>>({});
  protected readonly commentBusy = signal<Record<number, boolean>>({});
  protected readonly categories = signal<Category[]>([]);
  protected readonly tags = signal<Tag[]>([]);
  protected readonly editingEstado = signal<Post['estado'] | null>(null);
  protected readonly approvingId = signal<number | null>(null);
  protected readonly replyOpen = signal<number | null>(null);
  protected readonly replyDrafts = signal<Record<number, string>>({});
  protected readonly rejectTarget = signal<{ post: Post; comment: Comment } | null>(null);
  protected readonly composerTab = signal<ComposerTab>('estado');
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly showLivePreview = signal(true);
  protected readonly liveContent = signal('');
  protected readonly liveVideoPost = signal<Post | null>(null);
  protected readonly timeAgo = timeAgo;
  protected readonly titleFonts = TEXT_FONTS;
  protected readonly roleLabel = roleLabel;
  private imageFile: File | null = null;
  private objectPreview: string | null = null;
  private currentPageUrl: string | null = null;

  protected readonly canCreate = computed(() => this.canWritePosts());

  protected readonly canModerate = computed(() => {
    const rol = this.currentUser()?.rol;
    return rol === 'EDITOR' || rol === 'SUPERVISOR' || rol === 'ADMIN';
  });

  protected readonly form = this.formBuilder.group({
    titulo: this.formBuilder.nonNullable.control('', Validators.required),
    titulo_font: this.formBuilder.nonNullable.control('Arial'),
    titulo_color: this.formBuilder.nonNullable.control('#1c1e21'),
    titulo_bold: this.formBuilder.nonNullable.control(false),
    titulo_italic: this.formBuilder.nonNullable.control(false),
    contenido: this.formBuilder.nonNullable.control('', Validators.required),
    estado: this.formBuilder.nonNullable.control<Post['estado']>('PENDIENTE_REVISION'),
    category_id: this.formBuilder.control<number | null>(null),
    category_name: this.formBuilder.nonNullable.control(''),
    tag_ids: this.formBuilder.nonNullable.control<number[]>([]),
    tag_names: this.formBuilder.nonNullable.control(''),
    video_url: this.formBuilder.nonNullable.control(''),
  });

  ngOnInit(): void {
    this.loadPosts();
    this.loadTaxonomy();
    this.authenticated.set(this.tokenStorage.getAccessToken() !== null);
    if (!this.authenticated()) {
      return;
    }

    this.api
      .get<PerfilUsuario>('usuarios/perfil/')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil) => this.currentUser.set(perfil),
      });
  }

  protected isAuthor(post: Post): boolean {
    const user = this.currentUser();
    return Boolean(user && post.autor.username === user.username);
  }

  protected canManage(post: Post): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    return post.autor.username === user.username || this.canModerate();
  }

  protected readonly estadosDisponibles = computed(() => {
    const options: Post['estado'][] = this.canModerate()
      ? ['BORRADOR', 'PENDIENTE_REVISION', 'PUBLICADO', 'ARCHIVADO']
      : ['BORRADOR', 'PENDIENTE_REVISION'];
    const current = this.editingEstado();
    return current && !options.includes(current) ? [...options, current] : options;
  });

  ngOnDestroy(): void {
    this.clearPreview();
  }

  protected titleFontCss(): string {
    return TEXT_FONTS.find((item) => item.label === this.form.controls.titulo_font.value)?.css ?? 'Arial, sans-serif';
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected openCreate(tab: ComposerTab = 'estado'): void {
    this.resetForm();
    this.editingId.set(null);
    this.composerTab.set(tab);
    this.errorMessage.set('');
    this.showForm.set(true);
  }

  protected startEdit(post: Post): void {
    this.editingEstado.set(post.estado);
    this.composerTab.set(this.tabFor(post));
    this.imageFile = null;
    this.setPreview(post.image, false);
    this.form.setValue({
      titulo: post.titulo,
      titulo_font: post.titulo_font || 'Arial',
      titulo_color: post.titulo_color || '#1c1e21',
      titulo_bold: post.titulo_bold,
      titulo_italic: post.titulo_italic,
      contenido: post.contenido,
      estado: post.estado,
      category_id: post.category?.id ?? null,
      category_name: '',
      tag_ids: post.tags.map((tag) => tag.id),
      tag_names: '',
      video_url: post.video_url ?? '',
    });
    this.rememberVideoUrl(post.video_url ?? '');
    this.liveContent.set(post.contenido);
    this.errorMessage.set('');
    this.editingId.set(post.id);
    this.showForm.set(true);
  }

  protected onRich(html: string): void {
    this.liveContent.set(html);
    const control = this.form.controls.contenido;
    if (control.value === html) {
      return;
    }
    control.setValue(html);
  }

  protected previewCategory(): string {
    const typed = this.form.controls.category_name.value.trim();
    if (typed) {
      return typed;
    }
    const id = this.form.controls.category_id.value;
    return this.categories().find((category) => category.id === id)?.nombre ?? '';
  }

  protected previewTagNames(): string[] {
    const selected = this.form.controls.tag_ids.value
      .map((id) => this.tags().find((tag) => tag.id === id)?.nombre)
      .filter((name): name is string => Boolean(name));
    const typed = this.form.controls.tag_names.value
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    return [...selected, ...typed];
  }

  protected rememberVideo(event: Event): void {
    this.rememberVideoUrl((event.target as HTMLInputElement).value);
  }

  protected onImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile = file;
    this.setPreview(file ? URL.createObjectURL(file) : null, Boolean(file));
  }

  protected cancel(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Completa el título y el contenido.');
      return;
    }

    if (this.submitting()) {
      return;
    }

    const value = toPostData(this.form.getRawValue());
    const editingId = this.editingId();
    this.errorMessage.set('');
    this.submitting.set(true);

    const image = this.imageFile;
    const request = editingId
      ? this.postsService.updatePost(editingId, value, image)
      : this.postsService.createPost(value, image);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.submitting.set(false);
        if (value.category_name || value.tag_names?.length) {
          this.loadTaxonomy();
        }
        this.cancel();
        if (editingId === null) {
          this.currentPageUrl = null;
        } else {
          this.posts.update((items) =>
            items.map((item) => (item.id === saved.id ? saved : item)),
          );
        }
        this.loadPosts(editingId === null ? saved : undefined);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(
          this.readError(error, editingId === null ? 'crear' : 'guardar'),
        );
      },
    });
  }

  protected remove(post: Post): void {
    if (this.submitting()) {
      return;
    }

    const confirmed = window.confirm(`¿Eliminar la publicación «${post.titulo}»?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);
    this.postsService
      .deletePost(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          if (this.editingId() === post.id) {
            this.cancel();
          }
          this.posts.update((items) => items.filter((item) => item.id !== post.id));
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.readError(error, 'eliminar'));
        },
      });
  }

  protected goToPage(url: string | null): void {
    if (!url) {
      return;
    }

    this.currentPageUrl = url;
    this.errorMessage.set('');
    this.loadPosts();
  }

  protected commentDraft(postId: number): string {
    return this.commentDrafts()[postId] ?? '';
  }

  protected commentError(postId: number): string {
    return this.commentErrors()[postId] ?? '';
  }

  protected commentNote(postId: number): string {
    return this.commentNotes()[postId] ?? '';
  }

  protected commentIsBusy(postId: number): boolean {
    return this.commentBusy()[postId] === true;
  }

  protected setCommentDraft(postId: number, value: string): void {
    this.commentDrafts.update((state) => ({ ...state, [postId]: value }));
  }

  protected textareaValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected appendComment(post: Post, comment: Comment): void {
    this.setCommentNote(post.id, '');
    this.posts.update((items) =>
      items.map((item) =>
        item.id === post.id
          ? {
              ...item,
              comments: [...(item.comments ?? []).filter((entry) => entry.id !== comment.id), comment],
            }
          : item,
      ),
    );
  }

  protected submitComment(post: Post, event?: Event): void {
    event?.preventDefault();
    const content = this.commentDraft(post.id).trim();
    if (!content) {
      this.setCommentError(post.id, 'Escribe un comentario.');
      return;
    }

    if (this.commentIsBusy(post.id)) {
      return;
    }

    this.setCommentError(post.id, '');
    this.setCommentNote(post.id, '');
    this.commentBusy.update((state) => ({ ...state, [post.id]: true }));
    this.commentService
      .createComment(post.id, content)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comment) => {
          this.commentBusy.update((state) => ({ ...state, [post.id]: false }));
          this.appendComment(post, comment);
          this.setCommentDraft(post.id, '');
        },
        error: (error: HttpErrorResponse) => {
          this.commentBusy.update((state) => ({ ...state, [post.id]: false }));
          this.setCommentError(post.id, this.readCommentError(error));
        },
      });
  }

  protected toggleReply(commentId: number): void {
    this.replyOpen.set(this.replyOpen() === commentId ? null : commentId);
  }

  protected setReplyDraft(commentId: number, value: string): void {
    this.replyDrafts.update((state) => ({ ...state, [commentId]: value }));
  }

  protected submitReply(post: Post, comment: Comment, event: Event): void {
    event.preventDefault();
    const content = (this.replyDrafts()[comment.id] ?? '').trim();
    if (!content) {
      this.setCommentError(post.id, 'Escribe una respuesta.');
      return;
    }
    if (this.commentIsBusy(post.id)) {
      return;
    }

    this.setCommentError(post.id, '');
    this.setCommentNote(post.id, '');
    this.commentBusy.update((state) => ({ ...state, [post.id]: true }));
    this.commentService
      .createComment(post.id, content, comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.commentBusy.update((state) => ({ ...state, [post.id]: false }));
          this.replyOpen.set(null);
          this.replyDrafts.update((state) => ({ ...state, [comment.id]: '' }));
          this.appendComment(post, saved);
        },
        error: (error: HttpErrorResponse) => {
          this.commentBusy.update((state) => ({ ...state, [post.id]: false }));
          this.setCommentError(post.id, this.readCommentError(error));
        },
      });
  }

  protected approve(post: Post, comment: Comment): void {
    if (this.approvingId() !== null) {
      return;
    }

    this.approvingId.set(comment.id);
    this.setCommentError(post.id, '');
    this.commentService
      .approveComment(comment.id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.approvingId.set(null);
          this.posts.update((items) =>
            items.map((item) =>
              item.id === post.id
                ? {
                    ...item,
                    comments: item.comments.map((entry) => (entry.id === saved.id ? saved : entry)),
                  }
                : item,
            ),
          );
        },
        error: () => {
          this.approvingId.set(null);
          this.setCommentError(post.id, 'No se pudo aprobar el comentario.');
        },
      });
  }

  protected askReject(post: Post, comment: Comment): void {
    this.rejectTarget.set({ post, comment });
  }

  protected confirmReject(message: string): void {
    const target = this.rejectTarget();
    if (!target || this.approvingId() !== null) {
      return;
    }

    this.rejectTarget.set(null);
    this.approvingId.set(target.comment.id);
    this.setCommentError(target.post.id, '');
    this.commentService
      .rejectComment(target.comment.id, message)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.approvingId.set(null);
          this.posts.update((items) =>
            items.map((item) =>
              item.id === target.post.id
                ? { ...item, comments: item.comments.filter((entry) => entry.id !== target.comment.id) }
                : item,
            ),
          );
        },
        error: () => {
          this.approvingId.set(null);
          this.setCommentError(target.post.id, 'No se pudo rechazar el comentario.');
        },
      });
  }

  private canWritePosts(): boolean {
    const rol = this.currentUser()?.rol;
    return rol === 'AUTOR' || rol === 'EDITOR' || rol === 'SUPERVISOR' || rol === 'ADMIN';
  }

  private defaultEstado(): Post['estado'] {
    return this.canModerate() ? 'PUBLICADO' : 'PENDIENTE_REVISION';
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

  protected setCommentError(postId: number, message: string): void {
    this.commentErrors.update((state) => ({ ...state, [postId]: message }));
  }

  protected setCommentNote(postId: number, message: string): void {
    this.commentNotes.update((state) => ({ ...state, [postId]: message }));
  }

  private readCommentError(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return 'Inicia sesión para comentar.';
    }
    if (error.status === 403) {
      return 'No tienes permiso para comentar.';
    }
    if (error.status === 400) {
      return 'Escribe un comentario antes de enviarlo.';
    }
    return 'No se pudo publicar el comentario. Inténtalo de nuevo.';
  }

  private resetForm(): void {
    this.editingEstado.set(null);
    this.form.reset({
      titulo: '',
      titulo_font: 'Arial',
      titulo_color: '#1c1e21',
      titulo_bold: false,
      titulo_italic: false,
      contenido: '',
      estado: this.defaultEstado(),
      category_id: null,
      category_name: '',
      tag_ids: [],
      tag_names: '',
      video_url: '',
    });
    this.imageFile = null;
    this.liveContent.set('');
    this.liveVideoPost.set(null);
    this.setPreview(null, false);
  }

  private rememberVideoUrl(url: string): void {
    const trimmed = url.trim();
    this.liveVideoPost.set(trimmed ? this.mediaShell(trimmed) : null);
  }

  private mediaShell(videoUrl: string): Post {
    const user = this.currentUser();
    return {
      id: this.editingId() ?? 0,
      titulo: this.form.controls.titulo.value,
      titulo_font: this.form.controls.titulo_font.value,
      titulo_color: this.form.controls.titulo_color.value,
      titulo_bold: this.form.controls.titulo_bold.value,
      titulo_italic: this.form.controls.titulo_italic.value,
      contenido: '',
      autor: {
        id: 0,
        username: user?.username ?? '',
        rol: user?.rol ?? '',
        profile_picture: user?.profile_picture ?? null,
      },
      category: null,
      tags: [],
      image: null,
      video_url: videoUrl,
      estado: this.form.controls.estado.value,
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
      comments: [],
    };
  }

  private tabFor(post: Post): ComposerTab {
    if (post.image) {
      return 'foto';
    }
    const preview = linkPreview(post.video_url);
    if (preview?.kind === 'youtube' || preview?.kind === 'vimeo') {
      return 'video';
    }
    if (preview) {
      return 'enlace';
    }
    return 'estado';
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

  private loadPosts(created?: Post): void {
    this.postsService
      .getPosts(this.currentPageUrl)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.nextPage.set(response.next);
          this.previousPage.set(response.previous);
          const posts = response.results;
          if (created && !posts.some((post) => post.id === created.id)) {
            this.posts.set([{ ...created, comments: created.comments ?? [] }, ...posts]);
            return;
          }
          this.posts.set(posts);
        },
        error: () => this.errorMessage.set('No se pudieron cargar las publicaciones.'),
      });
  }

  private readError(error: HttpErrorResponse, action: 'crear' | 'guardar' | 'eliminar'): string {
    if (error.status === 401) {
      return 'Inicia sesión para continuar.';
    }
    if (error.status === 403) {
      return 'No tienes permiso para realizar esta acción.';
    }
    if (error.status === 400) {
      const estado = error.error?.estado;
      if (Array.isArray(estado) && estado.length > 0) {
        return String(estado[0]);
      }
      return 'Revisa los datos de la publicación.';
    }
    if (action === 'eliminar') {
      return 'No se pudo eliminar la publicación.';
    }
    if (action === 'guardar') {
      return 'No se pudo guardar la publicación.';
    }
    return 'No se pudo crear la publicación. Inténtalo de nuevo.';
  }
}
