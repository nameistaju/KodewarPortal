import Announcement from '../models/Announcement.js';
import AppError from '../utils/AppError.js';
import { escapeRegex, paginated } from '../utils/query.js';

export const create = (payload, actorId) => Announcement.create({ ...payload, createdBy: actorId });

export const update = async (announcementId, payload, actorId) => {
  const announcement = await Announcement.findByIdAndUpdate(
    announcementId,
    { ...payload, updatedBy: actorId },
    { returnDocument: 'after', runValidators: true }
  );

  if (!announcement) throw new AppError('Announcement not found', 404);
  return announcement;
};

export const remove = async (announcementId) => {
  const announcement = await Announcement.findByIdAndDelete(announcementId);
  if (!announcement) throw new AppError('Announcement not found', 404);
};

export const list = (query) => {
  const filter = {};
  const now = new Date();

  if (query.activeOnly) {
    filter.visibleFrom = { $lte: now };
    filter.$or = [{ visibleUntil: { $exists: false } }, { visibleUntil: null }, { visibleUntil: { $gte: now } }];
  }
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$and = [...(filter.$and || []), { $or: [{ title: regex }, { message: regex }] }];
  }

  return paginated(Announcement, filter, query, { defaultSort: '-isPinned,-visibleFrom' });
};
