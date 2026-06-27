const express = require('express');
const router = express.Router();
const Edge = require('../models/Edge');
const Node = require('../models/Node');
const Zone = require('../models/Zone');
const { findZoneAtPoint } = require('../utils/zoneUtils');
const { updateNodeTypesForNodes } = require('../utils/nodeTypeService');

async function resolveEndpoint(userId, endpoint) {
    if (endpoint.type === 'node') {
        const node = await Node.findById(endpoint.nodeId);
        if (!node) throw new Error('Node not found');
        return node._id;
    }

    if (endpoint.type === 'zone') {
        let zone = null;
        if (endpoint.zoneId) {
            zone = await Zone.findById(endpoint.zoneId);
        } else if (endpoint.x !== undefined && endpoint.y !== undefined) {
            zone = await findZoneAtPoint(Zone, userId, endpoint.x, endpoint.y);
        }

        if (!zone) throw new Error('Zone not found at selected point');

        let zoneLinkNode = await Node.findOne({ userId, type: 'zone_link', zoneId: zone._id });
        const x = endpoint.x ?? zone.vertices.reduce((s, v) => s + v.x, 0) / zone.vertices.length;
        const y = endpoint.y ?? zone.vertices.reduce((s, v) => s + v.y, 0) / zone.vertices.length;

        if (zoneLinkNode) {
            zoneLinkNode.x = x;
            zoneLinkNode.y = y;
            zoneLinkNode.zoneId = zone._id;
            await zoneLinkNode.save();
        } else {
            zoneLinkNode = new Node({
                userId,
                name: `Lối vào ${zone.zone_name}`,
                type: 'zone_link',
                x,
                y,
                zoneId: zone._id,
            });
            await zoneLinkNode.save();
        }

        return zoneLinkNode._id;
    }

    throw new Error('Invalid endpoint type');
}

router.post('/', async (req, res) => {
    try {
        const { userId, fromNode, toNode, from, to } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        let fromId = fromNode;
        let toId = toNode;

        if (from) fromId = await resolveEndpoint(userId, from);
        if (to) toId = await resolveEndpoint(userId, to);

        if (!fromId || !toId) {
            return res.status(400).json({ message: 'fromNode and toNode are required' });
        }

        if (String(fromId) === String(toId)) {
            return res.status(400).json({ message: 'Cannot connect a node to itself' });
        }

        const existing = await Edge.findOne({
            userId,
            $or: [
                { fromNode: fromId, toNode: toId },
                { fromNode: toId, toNode: fromId },
            ],
        });

        if (existing) {
            return res.status(400).json({ message: 'Edge already exists' });
        }

        const newEdge = new Edge({ userId, fromNode: fromId, toNode: toId });
        await newEdge.save();

        await updateNodeTypesForNodes([fromId, toId]);

        const populated = await Edge.findById(newEdge._id)
            .populate('fromNode')
            .populate('toNode');

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error creating edge', error });
        console.error('Error creating edge:', error);
    }
});

router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const edges = await Edge.find({ userId })
            .populate('fromNode')
            .populate('toNode');

        res.status(200).json(edges);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching edges', error });
        console.error('Error fetching edges:', error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const edge = await Edge.findById(req.params.id);
        if (!edge) {
            return res.status(404).json({ message: 'Edge not found' });
        }

        const affectedNodes = [edge.fromNode, edge.toNode];
        await Edge.findByIdAndDelete(req.params.id);
        await updateNodeTypesForNodes(affectedNodes);

        res.status(200).json({ message: 'Edge deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting edge', error });
        console.error('Error deleting edge:', error);
    }
});

module.exports = router;
