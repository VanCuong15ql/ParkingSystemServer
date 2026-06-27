function isPointInPolygon(point, vertices) {
    const x = point.x;
    const y = point.y;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;

        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

async function findZoneAtPoint(Zone, userId, x, y) {
    const zones = await Zone.find({ userId });
    const point = { x, y };

    for (const zone of zones) {
        if (isPointInPolygon(point, zone.vertices)) {
            return zone;
        }
    }
    return null;
}

module.exports = { isPointInPolygon, findZoneAtPoint };
