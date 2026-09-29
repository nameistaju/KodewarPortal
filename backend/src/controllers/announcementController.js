import * as announcementService from '../services/announcementService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const create = catchAsync(async (req, res) => {
  const announcement = await announcementService.create(req.body, req.user._id);
  sendSuccess(res, 201, 'Announcement created successfully', { announcement });
});

export const update = catchAsync(async (req, res) => {
  const announcement = await announcementService.update(
    req.params.announcementId,
    req.body,
    req.user._id
  );
  sendSuccess(res, 200, 'Announcement updated successfully', { announcement });
});

export const remove = catchAsync(async (req, res) => {
  await announcementService.remove(req.params.announcementId);
  sendSuccess(res, 200, 'Announcement deleted successfully');
});

export const list = catchAsync(async (req, res) => {
  const result = await announcementService.list(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Announcements fetched successfully', result);
});
