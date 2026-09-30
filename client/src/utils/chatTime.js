export const formatChatTimestamp = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr;
  }

  if (isYesterday) {
    return `Yesterday ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
};

export const isMessageExpired = (expiresAt) => {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
};
