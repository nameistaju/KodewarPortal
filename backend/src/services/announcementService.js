let inMemoryAnnouncements = [
  {
    _id: '1',
    id: '1',
    title: 'Welcome to KODEWAR Workforce',
    content: 'All attendance & leave management is now active.',
    isPinned: true,
    visibleFrom: new Date().toISOString()
  }
];

export const create = async (payload) => {
  const item = {
    _id: String(Date.now()),
    id: String(Date.now()),
    title: payload.title,
    content: payload.content || payload.message || '',
    isPinned: Boolean(payload.isPinned),
    visibleFrom: payload.visibleFrom || new Date().toISOString()
  };
  inMemoryAnnouncements.push(item);
  return item;
};

export const update = async (announcementId, payload) => {
  const item = inMemoryAnnouncements.find((a) => a.id === String(announcementId) || a._id === String(announcementId));
  if (!item) return null;
  Object.assign(item, payload);
  return item;
};

export const remove = async (announcementId) => {
  inMemoryAnnouncements = inMemoryAnnouncements.filter((a) => a.id !== String(announcementId) && a._id !== String(announcementId));
  return true;
};

export const list = async () => {
  return {
    items: inMemoryAnnouncements,
    pagination: {
      page: 1,
      limit: 25,
      total: inMemoryAnnouncements.length,
      totalPages: 1
    }
  };
};
