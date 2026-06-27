const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Zone = require('../models/Zone');
const Edge = require('../models/Edge');
const { findZoneAtPoint } = require('../utils/zoneUtils');
const { getIntersectionSlotCounts } = require('../utils/pathfindingService');
const { updateNodeTypesForNodes } = require('../utils/nodeTypeService');

async function applyZoneLinkFromPosition(node, userId, x, y) {
    if (node.type !== 'zone_link') return node;

    const zone = await findZoneAtPoint(Zone, userId, x, y);
    if (!zone) {
        throw new Error('zone_link node must be placed inside a zone');
    }

    node.zoneId = zone._id;
    if (!node.name) {
        node.name = `Lối vào ${zone.zone_name}`;
    }
    return node;
}

router.get('/intersection-slots', async (req, res) => {
    try {
        const { userId, focusedEntranceId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const results = await getIntersectionSlotCounts(userId, focusedEntranceId || null);
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error calculating intersection slots', error });
        console.error('Error calculating intersection slots:', error);
    }
});

const USER_CREATABLE_TYPES = ['entrance', 'zone_link', 'connector'];

router.post('/', async (req, res) => {
    try {
        let { userId, name, type, x, y } = req.body;

        if (!userId || x === undefined || y === undefined) {
            return res.status(400).json({ message: 'userId, x, and y are required' });
        }

        if (!USER_CREATABLE_TYPES.includes(type)) {
            type = 'connector';
        }

        const newNode = new Node({ userId, name, type, x, y, zoneId: null });

        if (type === 'zone_link') {
            await applyZoneLinkFromPosition(newNode, userId, x, y);
        }

        await newNode.save();
        const populated = await Node.findById(newNode._id).populate('zoneId', 'zone_name');
        res.status(201).json(populated);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Error creating node', error });
        console.error('Error creating node:', error);
    }
});

router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const nodes = await Node.find({ userId }).populate('zoneId', 'zone_name');
        res.status(200).json(nodes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching nodes', error });
        console.error('Error fetching nodes:', error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const node = await Node.findById(req.params.id).populate('zoneId', 'zone_name');
        if (!node) {
            return res.status(404).json({ message: 'Node not found' });
        }
        res.status(200).json(node);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching node', error });
        console.error('Error fetching node:', error);
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, type, x, y } = req.body;
        const node = await Node.findById(req.params.id);

        if (!node) {
            return res.status(404).json({ message: 'Node not found' });
        }

        if (name !== undefined) node.name = name;
        if (x !== undefined) node.x = x;
        if (y !== undefined) node.y = y;

        const posX = x !== undefined ? x : node.x;
        const posY = y !== undefined ? y : node.y;

        if (type !== undefined) {
            if (node.type === 'intersection') {
                // intersection is auto-assigned; only allow entrance/zone_link override
                if (type === 'entrance' || type === 'zone_link') {
                    node.type = type;
                }
            } else if (USER_CREATABLE_TYPES.includes(type)) {
                node.type = type;
            }
        }

        if (node.type === 'zone_link') {
            await applyZoneLinkFromPosition(node, node.userId, posX, posY);
        } else if (node.type !== 'zone_link') {
            node.zoneId = null;
        }

        await node.save();
        const updatedNode = await Node.findById(node._id).populate('zoneId', 'zone_name');
        res.status(200).json(updatedNode);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Error updating node', error });
        console.error('Error updating node:', error);
    }
});

router.post('/location/:id', async (req, res) => {
    try {
        const { x, y } = req.body;
        const node = await Node.findById(req.params.id);

        if (!node) {
            return res.status(404).json({ message: 'Node not found' });
        }

        node.x = x;
        node.y = y;

        if (node.type === 'zone_link') {
            await applyZoneLinkFromPosition(node, node.userId, x, y);
        }

        await node.save();
        const updatedNode = await Node.findById(node._id).populate('zoneId', 'zone_name');
        res.status(200).json(updatedNode);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Error updating node location', error });
        console.error('Error updating node location:', error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const node = await Node.findById(req.params.id);
        if (!node) {
            return res.status(404).json({ message: 'Node not found' });
        }

        const connectedEdges = await Edge.find({
            $or: [{ fromNode: node._id }, { toNode: node._id }],
        });
        const affectedNodeIds = connectedEdges.flatMap((e) => [e.fromNode, e.toNode]);
        await Edge.deleteMany({
            $or: [{ fromNode: node._id }, { toNode: node._id }],
        });

        await Node.findByIdAndDelete(req.params.id);
        await updateNodeTypesForNodes(affectedNodeIds.filter((id) => String(id) !== String(node._id)));

        res.status(200).json({ message: 'Node deleted successfully', node });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting node', error });
        console.error('Error deleting node:', error);
    }
});

module.exports = router;
