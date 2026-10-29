import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Api } from '../../../core/services/api';

interface PendingUser {
  id: number;
  username: string;
  email: string;
  bio: string;
  profile_picture: string | null;
  rol: string;
  estado_cuenta: string;
  date_joined: string;
}

const ROLES = [
  { id: 'LECTOR', label: 'Lector' },
  { id: 'AUTOR', label: 'Autor' },
  { id: 'EDITOR', label: 'Editor' },
  { id: 'SUPERVISOR', label: 'Supervisor' },
  { id: 'ADMIN', label: 'Administrador' },
] as const;

@Component({
  selector: 'app-registros',
  styleUrl: './registros.css',
  templateUrl: './registros.html',
})
export class Registros implements OnInit {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles = signal<readonly { id: string; label: string }[]>([...ROLES]);
  protected readonly users = signal<PendingUser[]>([]);
  protected readonly rolesById = signal<Record<number, string>>({});
  protected readonly busyId = signal<number | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  ngOnInit(): void {
    this.api
      .get<{ rol: string }>('usuarios/perfil/')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((perfil) => {
        this.roles.set(
          perfil.rol === 'ADMIN' ? [...ROLES] : ROLES.filter((role) => role.id !== 'ADMIN'),
        );
      });
    this.load();
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected roleOf(user: PendingUser): string {
    return this.rolesById()[user.id] ?? 'LECTOR';
  }

  protected setRole(id: number, event: Event): void {
    const rol = (event.target as HTMLSelectElement).value;
    this.rolesById.update((state) => ({ ...state, [id]: rol }));
  }

  protected approve(user: PendingUser): void {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(user.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api
      .post<PendingUser>(`usuarios/${user.id}/aprobar/`, { rol: this.roleOf(user) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.users.update((items) => items.filter((item) => item.id !== user.id));
          this.successMessage.set(`${user.username} ya puede iniciar sesión.`);
        },
        error: (error: HttpErrorResponse) => {
          this.busyId.set(null);
          this.errorMessage.set(this.readError(error, 'No se pudo aprobar el registro.'));
        },
      });
  }

  protected reject(user: PendingUser): void {
    if (this.busyId() !== null) {
      return;
    }
    this.busyId.set(user.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api
      .post<void>(`usuarios/${user.id}/rechazar/`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.users.update((items) => items.filter((item) => item.id !== user.id));
          this.successMessage.set(`Se rechazó el registro de ${user.username}.`);
        },
        error: (error: HttpErrorResponse) => {
          this.busyId.set(null);
          this.errorMessage.set(this.readError(error, 'No se pudo rechazar el registro.'));
        },
      });
  }

  private load(): void {
    this.api
      .get<PendingUser[] | { results: PendingUser[] }>('usuarios/pendientes/')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const users = Array.isArray(data) ? data : (data.results ?? []);
          this.users.set(users);
          this.rolesById.set(Object.fromEntries(users.map((user) => [user.id, user.rol || 'LECTOR'])));
        },
        error: () => this.errorMessage.set('No se pudieron cargar los registros pendientes.'),
      });
  }

  private readError(error: HttpErrorResponse, fallback: string): string {
    const data: unknown = error.error;
    if (data && typeof data === 'object') {
      for (const value of Object.values(data as Record<string, unknown>)) {
        if (typeof value === 'string') {
          return value;
        }
        if (Array.isArray(value) && typeof value[0] === 'string') {
          return value[0];
        }
      }
    }
    return fallback;
  }
}
