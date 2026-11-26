const { v2: cloudinary } = require('cloudinary');
const axios = require('axios');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadStreamToCloudinary(readableStream, resourceType = 'auto', folder = 'ntwrkh_uploads') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        format: resourceType === 'video' ? 'mp4' : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      }
    );

    readableStream.pipe(uploadStream);
  });
}

async function uploadFromTelegram(fileId, resourceType = 'auto') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is missing');

  const fileInfoRes = await axios.get(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const filePath = fileInfoRes.data?.result?.file_path;
  if (!filePath) throw new Error('Could not resolve Telegram file_path');

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'stream',
  });

  return uploadStreamToCloudinary(response.data, resourceType);
}

async function uploadFromWhatsApp(mediaId, resourceType = 'auto') {
  const waToken = process.env.WHATSAPP_TOKEN;
  if (!waToken) throw new Error('WHATSAPP_TOKEN is missing');

  const metaRes = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${waToken}` },
  });
  const mediaUrl = metaRes.data?.url;
  if (!mediaUrl) throw new Error('Could not resolve WhatsApp media URL');

  const response = await axios({
    method: 'GET',
    url: mediaUrl,
    responseType: 'stream',
    headers: { Authorization: `Bearer ${waToken}` },
  });

  return uploadStreamToCloudinary(response.data, resourceType);
}

module.exports = {
  uploadFromTelegram,
  uploadFromWhatsApp,
};
