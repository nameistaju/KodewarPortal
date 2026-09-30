import multer from 'multer';
import path from 'path';
import AppError from '../utils/AppError.js';

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (_req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
    cb(new AppError('Only JPG, PNG, and WEBP image uploads are allowed', 400), false);
    return;
  }

  cb(null, true);
};

const hasValidImageSignature = (file) => {
  if (!file?.buffer?.length) return false;

  const buffer = file.buffer;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isWebp;
};

export const validateImageUpload = (req, _res, next) => {
  if (!req.file) {
    next();
    return;
  }

  if (!hasValidImageSignature(req.file)) {
    next(new AppError('Uploaded file content is not a valid image', 400));
    return;
  }

  next();
};

export const validateImageUploads = (req, _res, next) => {
  const files = Object.values(req.files || {}).flat();
  const invalidFile = files.find((file) => !hasValidImageSignature(file));

  if (invalidFile) {
    next(new AppError(`Uploaded file content is not a valid image: ${invalidFile.originalname || 'unknown file'}`, 400));
    return;
  }

  next();
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const allowedChatMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac'
]);

const chatFileFilter = (_req, file, cb) => {
  if (!allowedChatMimeTypes.has(file.mimetype)) {
    cb(
      new AppError(
        'Invalid chat media format. Only JPG, PNG, WEBP images and WebM, OGG, MP4, MP3, WAV, M4A, AAC voice notes are allowed.',
        400
      ),
      false
    );
    return;
  }
  cb(null, true);
};

export const uploadChatMedia = multer({
  storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

export const validateChatMediaUpload = (req, _res, next) => {
  if (!req.file) {
    next(new AppError('Media file is required for image or voice note uploads', 400));
    return;
  }
  if (req.file.size > 5 * 1024 * 1024) {
    next(new AppError('File size exceeds the 5MB limit', 413));
    return;
  }
  next();
};

