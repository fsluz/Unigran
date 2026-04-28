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

async function safeDestroy(publicId, resourceType) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
  } catch (_) {
    // Melhor esforço de limpeza quando a mídia viola regra de negócio.
  }
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
          ? [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }]
          : [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }],
      },
      (err, uploadResult) => {
        if (err) return reject(err);
        resolve(uploadResult);
      },
    );
    stream.end(file.buffer);
  });

  if (resourceType === 'video') {
    const duration = Number(result.duration || 0);
    const width = Number(result.width || 0);
    const height = Number(result.height || 0);
    const exceedsDuration = duration > 120;
    const exceedsResolution = width > 1920 || height > 1080;

    if (exceedsDuration || exceedsResolution) {
      await safeDestroy(result.public_id, 'video');
      const err = new Error('Video invalido. Limite: 2 minutos e resolucao maxima 1080p.');
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}
