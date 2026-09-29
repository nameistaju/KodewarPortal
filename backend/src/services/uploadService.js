import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

const allowedFolders = new Map([
  ['profile', 'profile'],
  ['profiles', 'profile']
]);

const extensionByMime = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const normalizeStorageFolder = (folder = 'profile') => {
  const normalized = String(folder || 'profile').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const [root, ...rest] = normalized.split('/').filter(Boolean);
  const mappedRoot = allowedFolders.get(root);

  if (!mappedRoot) {
    throw new AppError('Unsupported upload category', 400);
  }

  const safeRest = rest
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
    .filter((segment) => segment && segment !== '.' && segment !== '..');

  return path.join(mappedRoot, ...safeRest);
};

const resolveInsideUploadRoot = (...segments) => {
  const root = path.resolve(env.uploadRoot);
  const target = path.resolve(root, ...segments);

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new AppError('Invalid upload path', 400);
  }

  return target;
};

export const ensureUploadDirectories = async () => {
  await fs.mkdir(resolveInsideUploadRoot('profile'), { recursive: true });
};

export const uploadImageBuffer = async (file, folder = 'profile') => {
  if (!file) return null;

  const extension = extensionByMime.get(file.mimetype);
  if (!extension) throw new AppError('Only JPG, PNG, and WEBP image uploads are allowed', 400);

  const storageFolder = normalizeStorageFolder(folder);
  const directory = resolveInsideUploadRoot(storageFolder);
  await fs.mkdir(directory, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const absolutePath = resolveInsideUploadRoot(storageFolder, filename);
  const relativePath = path.relative(path.resolve(env.uploadRoot), absolutePath).replace(/\\/g, '/');

  try {
    await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });
  } catch (error) {
    logger.error('local_upload_failed', { message: error.message, folder: storageFolder });
    throw new AppError('Image upload failed. Please retry.', 500, { provider: 'local', reason: 'write_failed' });
  }

  return {
    url: `/uploads/${relativePath}`,
    publicId: relativePath,
    uploadedAt: new Date(),
    originalFilename: file.originalname || null,
    storageProvider: 'local'
  };
};

export const deleteUploadedImage = async (publicIdOrUrl) => {
  if (!publicIdOrUrl) return;

  const cleanPath = String(publicIdOrUrl).replace(/^\/uploads\//, '').replace(/\\/g, '/');
  const absolutePath = resolveInsideUploadRoot(cleanPath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    logger.error('local_upload_cleanup_failed', { publicId: cleanPath, message: error.message });
    throw new AppError('Uploaded image cleanup failed', 500, { provider: 'local', reason: 'cleanup_failed' });
  }
};
