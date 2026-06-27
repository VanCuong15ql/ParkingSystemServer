const express = require('express');
const multer = require('multer');
const AccessManage = require('../models/AccessManage');
const UserParking = require('../models/UserParking');
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

router.post('/entering', upload.single('file'), async (req, res) => {
    try {
        const { userId, uid } = req.body;

        if (!userId || !uid) {
            return res.status(400).json({ message: 'userId và uid là bắt buộc' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'File gửi lên không phải là ảnh hợp lệ' });
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
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );
        } catch (error) {
            console.error('Plate image processing error (entering):', error);
            return res.status(422).json({
                message: 'Xử lý ảnh biển số thất bại',
                error: error.message,
                requireCheck: true,
            });
        }

        publishGateOpen(getMqttClient(req), 'parking/response_gate_for_entering');

        const accessManage = new AccessManage({
            uid: user.uid,
            userId: user.userId,
            userParkingId: user._id,
            timeEntered: new Date(),
            plate_image_enter: plateResult.plate_image,
        });
        await accessManage.save();

        res.status(201).json({
            message: 'Vào cổng thành công',
            accessManage,
        });
    } catch (error) {
        console.error('Error gate entering:', error);
        if (error.message === 'File gửi lên không phải là ảnh hợp lệ') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Lỗi xử lý cổng vào', error: error.message });
    }
});

router.post('/exiting', upload.single('file'), async (req, res) => {
    try {
        const { userId, uid } = req.body;

        if (!userId || !uid) {
            return res.status(400).json({ message: 'userId và uid là bắt buộc' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'File gửi lên không phải là ảnh hợp lệ' });
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
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );
        } catch (error) {
            console.error('Plate image processing error (exiting):', error);
            return res.status(422).json({
                message: 'Xử lý ảnh biển số thất bại',
                error: error.message,
                requireCheck: true,
            });
        }


        publishGateOpen(getMqttClient(req), 'parking/response_gate_for_exiting');

        accessManageRecord.timeExited = new Date();
        accessManageRecord.plate_image_exit = plateResult.plate_image;
        await accessManageRecord.save();

        res.status(200).json({
            message: 'Ra cổng thành công',
            accessManage: accessManageRecord,
        });
    } catch (error) {
        console.error('Error gate exiting:', error);
        if (error.message === 'File gửi lên không phải là ảnh hợp lệ') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Lỗi xử lý cổng ra', error: error.message });
    }
});

module.exports = router;
