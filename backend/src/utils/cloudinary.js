import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { AppError } from './errors.js';

const { cloudName, apiKey, apiSecret } = config.cloudinary;
cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

const ensure = () => {
  if (!cloudName || !apiKey || !apiSecret) throw new AppError(503, 'File storage is not configured', 'STORAGE_NOT_CONFIGURED');
};

/** Upload an in-memory buffer. type 'authenticated' makes the asset private (used for alumni proof). */
export function uploadBuffer(buffer, { folder, resourceType = 'auto', type = 'upload' }) {
  ensure();
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: `diulink/${folder}`, resource_type: resourceType, type }, (err, result) => (err ? reject(err) : resolve(result)))
      .end(buffer);
  });
}

/** Only accept media URLs that live in OUR Cloudinary account. */
export const isOurAsset = url =>
  typeof url === 'string' && !!cloudName && url.startsWith(`https://res.cloudinary.com/${cloudName}/`);

/** Short-lived download link for a private proof document (admin review). */
export const proofDownloadUrl = (publicId, format) => {
  ensure();
  return cloudinary.utils.private_download_url(publicId, format || 'jpg', {
    type: 'authenticated', resource_type: 'image', expires_at: Math.floor(Date.now() / 1000) + 600,
  });
};
