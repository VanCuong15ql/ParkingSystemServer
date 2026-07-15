const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const AccessManage = require('../models/AccessManage');

function getMqttClient(req) {
    return req.app.get('mqttClient');
}

function publishGateOpen(mqttClient, topic) {
    if (mqttClient) {
        mqttClient.publish(topic, JSON.stringify({ message: 'open' }));
    }
}

// Get notifications by accessManageId
router.get('/', async (req, res) => {
    try {
        const { accessManageId } = req.query;
        if (!accessManageId) {
            return res.status(400).json({ message: 'accessManageId is required' });
        }

        const notifications = await Notification.find({ accessManageId });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Pass error - change all notifications for the same accessManageId to ErrorExitPass and update timeExited
router.put('/:id/pass', async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // Change all notifications for this accessManageId to ErrorExitPass
        await Notification.updateMany(
            { accessManageId: notification.accessManageId },
            { errorType: 'ErrorExitPass' }
        );

        // Update timeExited in AccessManage
        const accessManage = await AccessManage.findById(notification.accessManageId);
        if (accessManage && !accessManage.timeExited) {
            accessManage.timeExited = new Date();
            await accessManage.save();
        }

        // Send MQTT command to open gate
        const mqttClient = getMqttClient(req);
        publishGateOpen(mqttClient, 'parking/response_gate_for_exiting');

        res.status(200).json({ message: 'All errors passed successfully' });
    } catch (error) {
        console.error('Error passing notification:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
