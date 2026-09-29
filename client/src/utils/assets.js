const apiOrigin = (import.meta.env.VITE_BASE_URL || '').replace(/\/$/, '');

export const assetUrl = (url) => {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/uploads/')) return `${apiOrigin}${value}`;
  if (value.startsWith('uploads/')) return `${apiOrigin}/${value}`;
  return value;
};
