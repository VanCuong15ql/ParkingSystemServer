const FormData = require('form-data');
const axios = require('axios');

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;

function getBaseUrl() {
    const baseUrl = (process.env.IMAGE_PROCESSING_SERVER_URL || '').replace(/\/$/, '');
    if (!baseUrl) {
        throw new Error('IMAGE_PROCESSING_SERVER_URL chưa được cấu hình');
    }
    return baseUrl;
}

function ensureImageFilename(originalName, mimeType) {
    const name = originalName || 'plate.jpg';
    if (/\.(jpe?g|png|webp|bmp)$/i.test(name)) {
        return name;
    }
    const extMap = {
        'image/png': '.png',
        'image/webp': '.webp',
        'image/bmp': '.bmp',
    };
    const ext = extMap[mimeType] || '.jpg';
    return `${name.replace(/\.[^.]+$/, '')}${ext}`;
}

function normalizeMimeType(mimeType, filename) {
    if (mimeType && mimeType.startsWith('image/')) {
        return mimeType;
    }
    if (/\.png$/i.test(filename)) return 'image/png';
    if (/\.webp$/i.test(filename)) return 'image/webp';
    return 'image/jpeg';
}

async function pollTaskResult(baseUrl, taskId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        const response = await axios.get(`${baseUrl}/api/v1/task/${taskId}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        const data = response.data;
        const status = (data.status || '').toUpperCase();

        if (status === 'SUCCESS') {
            return data.result;
        }
        if (status === 'FAILED') {
            throw new Error(data.error || 'Xử lý ảnh thất bại');
        }
    }

    throw new Error('Hết thời gian chờ xử lý ảnh');
}

async function processPlateImage(fileBuffer, originalName, mimeType) {
    const baseUrl = getBaseUrl();
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    if (!buffer.length) {
        throw new Error('File ảnh rỗng');
    }

    const filename = ensureImageFilename(originalName, mimeType);
    const contentType = normalizeMimeType(mimeType, filename);

    const form = new FormData();
    form.append('file', buffer, {
        filename,
        contentType,
        knownLength: buffer.length,
    });

    let predictData;
    try {
        const response = await axios.post(`${baseUrl}/api/v1/predict`, form, {
            headers: {
                ...form.getHeaders(),
                'ngrok-skip-browser-warning': 'true',
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 30000,
        });
        predictData = response.data;
    } catch (error) {
        const serverError = error.response?.data?.error || error.response?.data?.detail;
        const status = error.response?.status;
        console.error('Predict API error:', status, error.response?.data || error.message);
        throw new Error(serverError || error.message || 'Không thể gửi ảnh lên server xử lý');
    }

    if (!predictData?.task_id) {
        throw new Error(predictData?.error || 'Không nhận được task_id từ server xử lý ảnh');
    }

    const result = await pollTaskResult(baseUrl, predictData.task_id);

    if (!result) {
        throw new Error('Kết quả xử lý ảnh không hợp lệ');
    }
    if (result.status === 'failed') {
        throw new Error(result.error || 'Xử lý ảnh biển số thất bại');
    }
    if (result.status !== 'success') {
        throw new Error('Kết quả xử lý ảnh không hợp lệ');
    }

    return {
        plate_text: result.plate_text || '',
        plate_image: result.image_crop_base64 || '',
    };
}

module.exports = { processPlateImage };
