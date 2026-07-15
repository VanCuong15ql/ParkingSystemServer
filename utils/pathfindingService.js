const Node = require('../models/Node');
const Edge = require('../models/Edge');
const ParkingSpace = require('../models/parkingSpace');
const User = require('../models/user');
const { emitIntersectionSlotsUpdate } = require('../socket/socket');

function buildAdjacency(edges) {
    const graph = new Map();

    const addEdge = (a, b) => {
        const keyA = String(a);
        const keyB = String(b);
        if (!graph.has(keyA)) graph.set(keyA, new Set());
        if (!graph.has(keyB)) graph.set(keyB, new Set());
        graph.get(keyA).add(keyB);
        graph.get(keyB).add(keyA);
    };

    edges.forEach((edge) => {
        addEdge(edge.fromNode, edge.toNode);
    });

    return graph;
}

function collectZoneIdsFromDirection(startNodeId, intersectionId, graph, nodeMap, focusedEntranceId) {
    const visited = new Set();
    const zoneIds = new Set();

    const dfs = (currentId, prevId) => {
        const key = String(currentId);
        if (visited.has(key)) return;
        visited.add(key);

        const node = nodeMap.get(key);

        if (node?.type === 'entrance') {
            return;
        }

        if (node?.type === 'zone_link' && node.zoneId) {
            zoneIds.add(String(node.zoneId._id || node.zoneId));
        }

        const neighbors = graph.get(key) || new Set();
        neighbors.forEach((neighborId) => {
            if (neighborId === String(prevId)) return;

            const neighbor = nodeMap.get(neighborId);
            if (neighbor?.type === 'entrance') {
                if (focusedEntranceId && String(neighborId) === String(focusedEntranceId)) {
                    return;
                }
                if (focusedEntranceId && String(neighborId) !== String(focusedEntranceId)) {
                    return;
                }
                return;
            }

            dfs(neighborId, currentId);
        });
    };

    dfs(String(startNodeId), String(intersectionId));
    return zoneIds;
}

function isDirectionTowardEntrance(neighborId, intersectionId, graph, nodeMap, focusedEntranceId) {
    const neighbor = nodeMap.get(String(neighborId));
    if (!neighbor) return true;

    if (neighbor.type === 'entrance') {
        return true;
    }

    if (!focusedEntranceId) return false;

    const visited = new Set();
    let foundEntrance = false;

    const dfs = (currentId, prevId) => {
        const key = String(currentId);
        if (visited.has(key)) return;
        visited.add(key);

        const node = nodeMap.get(key);
        if (node?.type === 'entrance' && String(currentId) === String(focusedEntranceId)) {
            foundEntrance = true;
            return;
        }
        if (node?.type === 'entrance') return;

        const neighbors = graph.get(key) || new Set();
        neighbors.forEach((nextId) => {
            if (nextId === String(prevId)) return;
            dfs(nextId, currentId);
        });
    };

    dfs(String(neighborId), String(intersectionId));
    return foundEntrance;
}

async function resolveFocusedEntranceId(userId, focusedEntranceId) {
    if (focusedEntranceId) {
        const node = await Node.findOne({ _id: focusedEntranceId, userId, type: 'entrance' });
        if (node) return String(node._id);
    }

    const user = await User.findById(userId);
    if (user?.focusedEntranceId) {
        const node = await Node.findOne({ _id: user.focusedEntranceId, userId, type: 'entrance' });
        if (node) return String(node._id);
    }

    const firstEntrance = await Node.findOne({ userId, type: 'entrance' });
    return firstEntrance ? String(firstEntrance._id) : null;
}

async function getIntersectionSlotCounts(userId, focusedEntranceId = null, mqttClient = null) {
    const [nodes, edges, parkingSpaces, activeEntranceId] = await Promise.all([
        Node.find({ userId }).populate('zoneId', 'zone_name'),
        Edge.find({ userId }),
        ParkingSpace.find({ userId }),
        resolveFocusedEntranceId(userId, focusedEntranceId),
    ]);

    const nodeMap = new Map(nodes.map((n) => [String(n._id), n]));
    const graph = buildAdjacency(edges);
    const results = [];

    const intersectionNodes = nodes.filter((n) => n.type === 'intersection');

    for (const intersection of intersectionNodes) {
        const intersectionId = String(intersection._id);
        const neighbors = [...(graph.get(intersectionId) || [])];

        const directions = neighbors
            .filter((neighborId) => {
                const neighbor = nodeMap.get(neighborId);
                if (!neighbor) return false;

                if (neighbor.type === 'entrance') {
                    return false;
                }

                if (isDirectionTowardEntrance(neighborId, intersectionId, graph, nodeMap, activeEntranceId)) {
                    return false;
                }

                return true;
            })
            .map((neighborId) => {
                const neighbor = nodeMap.get(neighborId);
                const zoneIds = collectZoneIdsFromDirection(
                    neighborId,
                    intersectionId,
                    graph,
                    nodeMap,
                    activeEntranceId
                );

                const availableSlots = parkingSpaces.filter((space) => {
                    const zoneId = space.zone_id ? String(space.zone_id) : null;
                    return zoneId && zoneIds.has(zoneId) && space.state === 'available';
                }).length;

                // Publish to MQTT topic parking/availableSlots
                if (mqttClient && mqttClient.connected) {
                    // Find the Edge between intersectionId and neighborId
                    const edge = edges.find(e => 
                        (String(e.fromNode) === intersectionId && String(e.toNode) === neighborId) ||
                        (String(e.fromNode) === neighborId && String(e.toNode) === intersectionId)
                    );
                    
                    if (edge) {
                        const message = {
                            id: String(edge._id),
                            availableSlots
                        };
                        mqttClient.publish('parking/availableSlots', JSON.stringify(message));
                        console.log(`Published to parking/availableSlots:`, message);
                    }
                }

                return {
                    neighborNodeId: neighborId,
                    neighborName: neighbor?.name || neighbor?.type || 'Node',
                    availableSlots,
                    neighborX: neighbor?.x ?? 0,
                    neighborY: neighbor?.y ?? 0,
                };
            });

        results.push({
            nodeId: intersectionId,
            nodeName: intersection.name,
            x: intersection.x,
            y: intersection.y,
            focusedEntranceId: activeEntranceId,
            directions,
        });
    }

    // Emit update via socket to the specific user
    try {
        console.log('[pathfindingService] Attempting to emit intersectionSlotsUpdate for userId:', userId);
        emitIntersectionSlotsUpdate(userId, results);
        console.log('[pathfindingService] Successfully emitted intersectionSlotsUpdate');
    } catch (error) {
        console.error('[pathfindingService] Error emitting socket update:', error);
    }

    return results;
}

module.exports = { getIntersectionSlotCounts, resolveFocusedEntranceId };
