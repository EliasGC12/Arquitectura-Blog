import { environment } from '../../environments/environment';

export function apiBase(): string {
  const value = environment.apiUrl.trim();
  return value.endsWith('/') ? value : `${value}/`;
}
