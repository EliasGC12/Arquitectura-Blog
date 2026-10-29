export function timeAgo(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) {
    return '';
  }

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return 'ahora';
  }
  if (minutes < 60) {
    return minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  }

  return date.toLocaleDateString('es');
}
