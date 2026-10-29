import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { apiBase } from '../../core/api-url';
import { TokenStorage } from '../../core/services/token-storage';

export interface AuthTokens {
  access: string;
  refresh: string;
}

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorage);

  login(username: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${apiBase()}token/`, { username, password })
      .pipe(tap((tokens) => this.tokenStorage.save(tokens.access, tokens.refresh)));
  }

  register(payload: FormData): Observable<unknown> {
    return this.http.post(`${apiBase()}usuarios/registro/`, payload);
  }
}
