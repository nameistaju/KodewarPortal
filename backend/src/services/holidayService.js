import Holiday from '../models/Holiday.js';
import AppError from '../utils/AppError.js';
import { escapeRegex, paginated } from '../utils/query.js';

export const create = (payload, actorId) => Holiday.create({ ...payload, createdBy: actorId });

export const update = async (holidayId, payload, actorId) => {
  const holiday = await Holiday.findByIdAndUpdate(
    holidayId,
    { ...payload, updatedBy: actorId },
    { returnDocument: 'after', runValidators: true }
  );

  if (!holiday) throw new AppError('Holiday not found', 404);
  return holiday;
};

export const remove = async (holidayId) => {
  const holiday = await Holiday.findByIdAndDelete(holidayId);
  if (!holiday) throw new AppError('Holiday not found', 404);
};

export const list = (query) => {
  const filter = {};

  if (query.year) {
    filter.date = {
      $gte: new Date(Number(query.year), 0, 1),
      $lte: new Date(Number(query.year), 11, 31, 23, 59, 59, 999)
    };
  }
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

  return paginated(Holiday, filter, query, { defaultSort: 'date' });
};
