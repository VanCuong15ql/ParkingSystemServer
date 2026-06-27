const Edge = require('../models/Edge');
const Node = require('../models/Node');

async function updateNodeTypeByEdgeCount(nodeId) {
    const node = await Node.findById(nodeId);
    if (!node) return;

    if (node.type === 'entrance' || node.type === 'zone_link') return;

    const edgeCount = await Edge.countDocuments({
        $or: [{ fromNode: nodeId }, { toNode: nodeId }],
    });

    if (edgeCount >= 3) {
        node.type = 'intersection';
    } else if (edgeCount >= 1) {
        node.type = 'connector';
    }

    await node.save();
}

async function updateNodeTypesForNodes(nodeIds) {
    const uniqueIds = [...new Set(nodeIds.map(String))];
    await Promise.all(uniqueIds.map((id) => updateNodeTypeByEdgeCount(id)));
}

module.exports = { updateNodeTypeByEdgeCount, updateNodeTypesForNodes };
