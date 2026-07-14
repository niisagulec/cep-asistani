export const menuItemTypes = [
  { value: 'SOUP', label: 'Çorba' },
  { value: 'MAIN', label: 'Ana yemek' },
  { value: 'SIDE', label: 'Yardımcı yemek' },
  { value: 'MEZE', label: 'Meze / Salata / Ek' },
  { value: 'DESSERT', label: 'Tatlı' },
  { value: 'DRINK', label: 'İçecek' },
  { value: 'OTHER', label: 'Diğer' },
];

export const menuItemTypeLabels = menuItemTypes.reduce((labels, itemType) => {
  labels[itemType.value] = itemType.label;
  return labels;
}, {});

export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // Handles YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }
  
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMenuDate(value) {
  const date = parseLocalDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(date);
}

export function formatShortDate(value) {
  const date = parseLocalDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('tr-TR').format(date);
}

export function toInputDate(value = new Date()) {
  const date = parseLocalDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
