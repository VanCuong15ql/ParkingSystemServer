const express = require('express');
const multer = require('multer');
const axios = require('axios');
const AccessManage = require('../models/AccessManage');
const UserParking = require('../models/UserParking');
const Notification = require('../models/Notification');
const { processPlateImage } = require('../utils/plateImageProcessor');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('File gửi lên không phải là ảnh hợp lệ'));
        }
    },
});

function getMqttClient(req) {
    return req.app.get('mqttClient');
}

function publishGateOpen(mqttClient, topic) {
    if (mqttClient) {
        mqttClient.publish(topic, JSON.stringify({ message: 'open' }));
    }
}

// Helper function to download image from URL and convert to buffer
async function downloadImageFromUrl(imageUrl) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
        });
        return {
            buffer: Buffer.from(response.data),
            originalname: 'image.jpg',
            mimetype: response.headers['content-type'] || 'image/jpeg',
        };
    } catch (error) {
        console.error('Error downloading image from URL:', error);
        throw new Error('Không thể tải ảnh từ URL');
    }
}

router.post('/entering', upload.single('file'), async (req, res) => {
    try {
        const { userId, uid, imageUrl } = req.body;

        if (!userId || !uid) {
            return res.status(400).json({ message: 'userId và uid là bắt buộc' });
        }

        // Check if we have imageUrl or file upload
        if (!req.file && !imageUrl) {
            return res.status(400).json({ message: 'Cần gửi file ảnh hoặc imageUrl' });
        }

        // Get image data from file or URL
        let imageData;
        if (imageUrl) {
            imageData = await downloadImageFromUrl(imageUrl);
        } else {
            imageData = {
                buffer: req.file.buffer,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
            };
        }

        const user = await UserParking.findOne({ uid, userId });
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng bãi đỗ' });
        }

        const existingAccessManage = await AccessManage.findOne({
            uid: user.uid,
            userId: user.userId,
            timeExited: null,
        });
        if (existingAccessManage) {
            return res.status(409).json({ message: 'Người dùng đã vào bãi, chưa ra' });
        }

        let plateResult;
        try {
            plateResult = await processPlateImage(
                imageData.buffer,
                imageData.originalname,
                imageData.mimetype
            );
        } catch (error) {
            console.error('Plate image processing error (entering):', error);

            // Still open gate even if image processing fails
            publishGateOpen(getMqttClient(req), 'parking/response_gate_for_entering');

            // Convert original image buffer to base64
            const originalImageBase64 = imageData.buffer.toString('base64');

            const accessManage = new AccessManage({
                uid: user.uid,
                userId: user.userId,
                userParkingId: user._id,
                timeEntered: new Date(),
                plate_text_enter: '',
                plate_image_enter: originalImageBase64,
            });
            await accessManage.save();

            // Create notification for error
            const notification = new Notification({
                accessManageId: accessManage._id,
                errorMessage: 'lỗi xử lý ảnh ở cổng vào',
                errorType: 'ErrorEnter',
            });
            await notification.save();

            return res.status(201).json({
                message: 'Vào cổng thành công (có lỗi xử lý ảnh)',
                accessManage,
                hasError: true,
            });
        }

        publishGateOpen(getMqttClient(req), 'parking/response_gate_for_entering');

        // Convert original image buffer to base64
        const originalImageBase64 = imageData.buffer.toString('base64');

        const accessManage = new AccessManage({
            uid: user.uid,
            userId: user.userId,
            userParkingId: user._id,
            timeEntered: new Date(),
            plate_text_enter: plateResult.plate_text,
            plate_image_enter: originalImageBase64,
        });
        await accessManage.save();

        res.status(201).json({
            message: 'Vào cổng thành công',
            accessManage,
        });
    } catch (error) {
        console.error('Error gate entering:', error);
        if (error.message === 'File gửi lên không phải là ảnh hợp lệ' || error.message === 'Không thể tải ảnh từ URL') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Lỗi xử lý cổng vào', error: error.message });
    }
});

router.post('/exiting', upload.single('file'), async (req, res) => {
    try {
        const { userId, uid, imageUrl } = req.body;

        if (!userId || !uid) {
            return res.status(400).json({ message: 'userId và uid là bắt buộc' });
        }

        // Check if we have imageUrl or file upload
        if (!req.file && !imageUrl) {
            return res.status(400).json({ message: 'Cần gửi file ảnh hoặc imageUrl' });
        }

        // Get image data from file or URL
        let imageData;
        if (imageUrl) {
            imageData = await downloadImageFromUrl(imageUrl);
        } else {
            imageData = {
                buffer: req.file.buffer,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
            };
        }

        const accessManageRecord = await AccessManage.findOne({
            uid,
            userId,
            timeExited: null,
        });
        if (!accessManageRecord) {
            return res.status(404).json({ message: 'Không tìm thấy bản ghi vào cổng hoặc đã ra cổng' });
        }

        let plateResult;
        try {
            plateResult = await processPlateImage(
                imageData.buffer,
                imageData.originalname,
                imageData.mimetype
            );
        } catch (error) {
            console.error('Plate image processing error (exiting):', error);

            // Convert original image buffer to base64
            const originalImageBase64 = imageData.buffer.toString('base64');

            // Save image but do NOT open gate
            accessManageRecord.plate_image_exit = originalImageBase64;
            await accessManageRecord.save();

            // Create notification for error
            const notification = new Notification({
                accessManageId: accessManageRecord._id,
                errorMessage: 'lỗi xử lý ảnh ở cổng ra',
                errorType: 'ErrorExit',
            });
            await notification.save();

            return res.status(422).json({
                message: 'Xử lý ảnh biển số thất bại',
                error: error.message,
                requireCheck: true,
            });
        }

        // Check if plate text matches
        if (accessManageRecord.plate_text_enter && plateResult.plate_text &&
            accessManageRecord.plate_text_enter !== plateResult.plate_text) {

            // Convert original image buffer to base64
            const originalImageBase64 = imageData.buffer.toString('base64');

            accessManageRecord.timeExited = new Date();
            accessManageRecord.plate_text_exit = plateResult.plate_text;
            accessManageRecord.plate_image_exit = originalImageBase64;
            await accessManageRecord.save();

            // Create notification for plate mismatch
            const notification = new Notification({
                accessManageId: accessManageRecord._id,
                errorMessage: 'lỗi biển số xe không khớp',
                errorType: 'ErrorExit',
            });
            await notification.save();

            return res.status(422).json({
                message: 'Biển số xe không khớp',
                error: 'Biển số xe không khớp',
                requireCheck: true,
            });
        }

        publishGateOpen(getMqttClient(req), 'parking/response_gate_for_exiting');

        // Convert original image buffer to base64
        const originalImageBase64 = imageData.buffer.toString('base64');

        accessManageRecord.timeExited = new Date();
        accessManageRecord.plate_text_exit = plateResult.plate_text;
        accessManageRecord.plate_image_exit = originalImageBase64;
        await accessManageRecord.save();

        res.status(200).json({
            message: 'Ra cổng thành công',
            accessManage: accessManageRecord,
        });
    } catch (error) {
        console.error('Error gate exiting:', error);
        if (error.message === 'File gửi lên không phải là ảnh hợp lệ' || error.message === 'Không thể tải ảnh từ URL') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Lỗi xử lý cổng ra', error: error.message });
    }
});

module.exports = router;
