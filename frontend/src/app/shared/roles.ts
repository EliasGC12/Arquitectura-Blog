export const ROLE_LABELS: Record<string, string> = {
  LECTOR: 'Lector',
  AUTOR: 'Autor',
  EDITOR: 'Editor',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Admin',
};

export function roleLabel(rol: string | null | undefined): string {
  if (!rol) {
    return '';
  }
  return ROLE_LABELS[rol] ?? rol;
}
