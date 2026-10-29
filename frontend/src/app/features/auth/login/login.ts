import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MediaImage, MediaUrlPipe } from '../../../shared/media/media';
import { AuthService } from '../auth.service';

const PRESET_AVATARS = [
  { style: 'avataaars', seed: 'Luna' },
  { style: 'avataaars', seed: 'Marco' },
  { style: 'avataaars', seed: 'Sofia' },
  { style: 'avataaars', seed: 'Andres' },
  { style: 'bottts', seed: 'Nova' },
  { style: 'bottts', seed: 'Pixel' },
  { style: 'bottts', seed: 'Orbit' },
  { style: 'bottts', seed: 'Bolt' },
  { style: 'lorelei', seed: 'Valeria' },
  { style: 'lorelei', seed: 'Hugo' },
  { style: 'fun-emoji', seed: 'Sol' },
  { style: 'fun-emoji', seed: 'Rio' },
] as const;

@Component({
  imports: [ReactiveFormsModule, MediaImage, MediaUrlPipe],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private avatarFile: File | null = null;
  private avatarUrl: string | null = null;

  protected readonly presetAvatars = PRESET_AVATARS;
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);
  protected readonly selectedAvatar = signal('');
  protected readonly picturePreview = signal<string | null>(null);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly registerForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    password_confirm: ['', Validators.required],
    bio: [''],
  });

  ngOnDestroy(): void {
    this.revokePreview();
  }

  protected initial(): string {
    return this.registerForm.controls.username.value.trim().charAt(0).toUpperCase() || '?';
  }

  protected avatarSrc(style: string, seed: string): string {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  }

  protected showLogin(): void {
    this.errorMessage.set('');
    this.mode.set('login');
  }

  protected showRegister(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.mode.set('register');
  }

  protected pickAvatar(style: string, seed: string): void {
    this.avatarFile = null;
    this.revokePreview();
    this.selectedAvatar.set(`${style}:${seed}`);
    this.picturePreview.set(this.avatarSrc(style, seed));
  }

  protected onAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.avatarFile = file;
    this.selectedAvatar.set('');
    this.revokePreview();
    if (!file) {
      this.picturePreview.set(null);
      return;
    }
    this.avatarUrl = URL.createObjectURL(file);
    this.picturePreview.set(this.avatarUrl);
  }

  protected onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Completa el usuario y la contraseña.');
      return;
    }

    if (this.submitting()) {
      return;
    }

    const { username, password } = this.loginForm.getRawValue();
    this.errorMessage.set('');
    this.successMessage.set('');
    this.submitting.set(true);

    this.auth.login(username, password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/posts']);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.readError(error, 'No se pudo iniciar sesión. Inténtalo de nuevo.'));
      },
    });
  }

  protected onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.errorMessage.set('Completa usuario, correo y contraseña.');
      return;
    }

    if (this.submitting()) {
      return;
    }

    const payload = this.registerForm.getRawValue();
    if (payload.password !== payload.password_confirm) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    const data = new FormData();
    data.append('username', payload.username.trim());
    data.append('email', payload.email.trim());
    data.append('password', payload.password);
    data.append('password_confirm', payload.password_confirm);
    data.append('bio', payload.bio.trim());
    if (this.avatarFile) {
      data.append('profile_picture', this.avatarFile);
    } else if (this.selectedAvatar()) {
      const [style, seed] = this.selectedAvatar().split(':');
      data.append('avatar_style', style);
      data.append('avatar_seed', seed);
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.submitting.set(true);

    this.auth
      .register(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.registerForm.reset({ bio: '' });
          this.avatarFile = null;
          this.selectedAvatar.set('');
          this.revokePreview();
          this.picturePreview.set(null);
          this.mode.set('login');
          this.successMessage.set(
            'Cuenta creada. Un administrador debe aprobarla antes de que puedas iniciar sesión.',
          );
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMessage.set(this.readError(error, 'No se pudo crear la cuenta.'));
        },
      });
  }

  private revokePreview(): void {
    if (this.avatarUrl) {
      URL.revokeObjectURL(this.avatarUrl);
      this.avatarUrl = null;
    }
  }

  private readError(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 401) {
      const detail = this.messageFrom(error.error);
      return detail || 'Usuario o contraseña incorrectos.';
    }

    return this.messageFrom(error.error) || fallback;
  }

  private messageFrom(data: unknown): string {
    if (!data || typeof data !== 'object') {
      return '';
    }
    const record = data as Record<string, unknown>;
    if (typeof record['detail'] === 'string') {
      return record['detail'];
    }
    for (const value of Object.values(record)) {
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
      }
    }
    return '';
  }
}
