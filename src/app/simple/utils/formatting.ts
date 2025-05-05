// src/app/simple/utils/formatting.ts
/**
 * Formatar tempo como HH:MM
 * @param date Data a ser formatada
 * @returns String formatada no formato HH:MM
 */
export const formatTime = (date: Date = new Date()): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Formatar duração em segundos como texto humanizado
 * @param seconds Duração em segundos
 * @returns String formatada (ex: "2 min 30 seg")
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)} seg`;
  } else if (seconds < 3600) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min} min${sec > 0 ? ` ${sec} seg` : ''}`;
  } else {
    const hr = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    return `${hr} h${min > 0 ? ` ${min} min` : ''}`;
  }
};

/**
 * Truncar texto com ellipsis se exceder o comprimento máximo
 * @param text Texto a ser truncado
 * @param maxLength Comprimento máximo
 * @returns Texto truncado ou original
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
};