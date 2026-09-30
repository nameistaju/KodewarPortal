import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

const isCloudinaryConfigured = () => {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret
  });
  logger.info('Cloudinary configured for image storage');
}

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
  try {
    await fs.mkdir(resolveInsideUploadRoot('profile'), { recursive: true });
  } catch (error) {
    logger.warn('Could not create upload directory', { error: error.message });
  }
};

const uploadToCloudinaryStream = (fileBuffer, folder = 'kodewar/profiles') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 600, height: 600, crop: 'limit', quality: 'auto' }]
      },
      (error, result) => {
        if (error) {
          logger.error('cloudinary_upload_failed', { message: error.message });
          reject(new AppError('Image upload to Cloudinary failed. Please retry.', 500, { provider: 'cloudinary', reason: 'upload_failed' }));
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            uploadedAt: new Date(),
            originalFilename: result.original_filename || null,
            storageProvider: 'cloudinary'
          });
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export const uploadImageBuffer = async (file, folder = 'profile') => {
  if (!file) return null;

  const extension = extensionByMime.get(file.mimetype);
  if (!extension) throw new AppError('Only JPG, PNG, and WEBP image uploads are allowed', 400);

  if (isCloudinaryConfigured()) {
    return await uploadToCloudinaryStream(file.buffer, `kodewar/${folder}`);
  }

  // Fallback to local storage if Cloudinary keys are not provided
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

  const strVal = String(publicIdOrUrl).trim();

  // If Cloudinary is configured and it's a Cloudinary publicId or URL
  if (isCloudinaryConfigured() && (strVal.includes('res.cloudinary.com') || strVal.includes('kodewar/'))) {
    let publicId = strVal;
    if (strVal.includes('res.cloudinary.com')) {
      // Extract publicId from Cloudinary URL (e.g. kodewar/profiles/sample)
      const parts = strVal.split('/upload/');
      if (parts[1]) {
        const withoutVersion = parts[1].replace(/^v\d+\//, '');
        publicId = withoutVersion.replace(/\.[a-zA-Z0-9]+$/, '');
      }
    }

    try {
      await cloudinary.uploader.destroy(publicId);
      logger.info('Deleted image from Cloudinary', { publicId });
    } catch (error) {
      logger.warn('Failed to delete image from Cloudinary', { publicId, message: error.message });
    }
    return;
  }

  // Fallback to local cleanup
  const cleanPath = strVal.replace(/^\/uploads\//, '').replace(/\\/g, '/');
  const absolutePath = resolveInsideUploadRoot(cleanPath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    logger.error('local_upload_cleanup_failed', { publicId: cleanPath, message: error.message });
  }
};
