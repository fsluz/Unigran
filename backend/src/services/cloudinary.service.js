import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function resourceTypeFromMime(mimetype = '') {
  if (mimetype === 'image/gif') return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'image';
}

export async function uploadMediaBuffer(file, folder = 'unigran/posts') {
  if (!file?.buffer) throw new Error('Arquivo inválido para upload');

  const resourceType = resourceTypeFromMime(file.mimetype);
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    quality: 'auto',
    fetch_format: 'auto',
    transformation: resourceType === 'image'
      ? [{ width: 1600, crop: 'limit' }]
      : [{ width: 1280, crop: 'limit' }],
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}
