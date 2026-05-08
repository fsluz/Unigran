import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function resourceTypeFromMime(mimetype = '') {
  if (mimetype === 'image/gif') return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'video';
  return 'image';
}

function safeFolder(folder = 'unigran/posts') {
  const value = String(folder || 'unigran/posts').replace(/\\/g, '/');
  const allowed = ['unigran/posts', 'unigran/comments', 'unigran/zuni', 'unigran/stories', 'unigran/profiles', 'unigran/groups'];
  return allowed.includes(value) ? value : 'unigran/posts';
}

async function safeDestroy(publicId, resourceType) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
  } catch (_) {
    // Melhor esforo de limpeza quando a midia viola regra de negcio.
  }
}

function cloudinaryVideoFrameUrl(url = '') {
  const value = String(url || '');
  if (!value.includes('/video/upload/')) return value;
  return value
    .replace('/video/upload/', '/video/upload/so_0/')
    .replace(/\.[a-z0-9]+$/i, '.jpg');
}

async function validateNsfwWithJigsaw(url, resourceType) {
  const apiKey = process.env.JIGSAWSTACK_API_KEY;
  if (!apiKey || !url) return { blocked: false, skipped: true };

  const imageUrl = resourceType === 'video' ? cloudinaryVideoFrameUrl(url) : url;
  const response = await fetch('https://api.jigsawstack.com/v1/validate/nsfw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ url: imageUrl }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const err = new Error('Falha ao validar conteudo +18.');
    err.statusCode = 502;
    throw err;
  }

  const threshold = Number(process.env.JIGSAWSTACK_NSFW_THRESHOLD || 0.72);
  const nsfwScore = Number(data.nsfw_score || 0);
  const nudityScore = Number(data.nudity_score || 0);
  const goreScore = Number(data.gore_score || 0);
  return {
    blocked: Boolean(data.nsfw || data.nudity || data.gore)
      || nsfwScore >= threshold
      || nudityScore >= threshold
      || goreScore >= threshold,
    data,
  };
}

export async function assertSafeMediaUrl(url, resourceType = 'image') {
  const nsfw = await validateNsfwWithJigsaw(url, resourceType);
  if (nsfw.blocked) {
    const err = new Error('Conteudo +18 proibido na plataforma.');
    err.statusCode = 400;
    throw err;
  }
  return true;
}

function publicIdFromCloudinaryUrl(url = '') {
  const value = String(url || '');
  const marker = '/upload/';
  const index = value.indexOf(marker);
  if (index < 0) return '';
  let path = value.slice(index + marker.length);
  path = path.replace(/^v\d+\//, '');
  path = path.replace(/\.[a-z0-9]+$/i, '');
  return path.startsWith('unigran/') ? path : '';
}

export async function destroyCloudinaryUrl(url) {
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) return false;
  await Promise.all([
    safeDestroy(publicId, 'image'),
    safeDestroy(publicId, 'video'),
  ]);
  return true;
}

export function createCloudinaryUploadSignature({ folder = 'unigran/posts', resourceType = 'image', timestamp = Math.floor(Date.now() / 1000) } = {}) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary nao configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.');
  }
  const cleanFolder = safeFolder(folder);
  const paramsToSign = {
    folder: cleanFolder,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder: cleanFolder,
    resourceType,
  };
}

export async function uploadMediaBuffer(file, folder = 'unigran/posts', limits = {}) {
  if (!file?.buffer) throw new Error('Arquivo invalido para upload');
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary nao configurado. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.');
  }

  const cleanFolder = safeFolder(folder);
  const resourceType = resourceTypeFromMime(file.mimetype);
  const maxDuration = limits.maxVideoDurationSec || 120;
  const maxResolution = limits.maxVideoResolution || 1080;
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cleanFolder,
        resource_type: resourceType,
        quality: 'auto',
        fetch_format: 'auto',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        transformation: resourceType === 'image'
          ? [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }]
          : [{ width: 1280, height: 720, crop: 'limit', quality: 'auto:good' }],
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
    const minDim = Math.min(width, height);
    const exceedsDuration = duration > maxDuration;
    const exceedsResolution = minDim > maxResolution;

    if (exceedsDuration || exceedsResolution) {
      await safeDestroy(result.public_id, 'video');
      const err = new Error(`Video muito grande. Limite: ate 1:30 e qualidade maxima ${maxResolution}p.`);
      err.statusCode = 400;
      throw err;
    }
  }

  try {
    await assertSafeMediaUrl(result.secure_url, resourceType);
  } catch (err) {
    await safeDestroy(result.public_id, resourceType);
    throw err;
  }

  return {
    url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
  };
}


