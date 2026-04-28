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
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary não configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.');
  }

  const resourceType = resourceTypeFromMime(file.mimetype);
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        quality: 'auto',
        fetch_format: 'auto',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        transformation: resourceType === 'image'
          ? [{ width: 1600, crop: 'limit' }]
          : [{ width: 1280, crop: 'limit' }],
      },
      (err, uploadResult) => {
        if (err) return reject(err);
        resolve(uploadResult);
      },
    );
    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}
