export interface Location {
    type: string,
    coordinates: any
}

export function createGeometry(location: Location): string {
//    console.info("location:" + JSON.stringify(location));

    if(location.type == 'LineString') {
        const coordinates = location.coordinates.map((c: any) =>  coordinatePair(c)).join(',');

        return `LINESTRING(${coordinates})`;
    } else if(location.type == 'Point') {
        const coordinates = coordinatePair(location.coordinates);

        return `POINT(${coordinates})`;
    }

    console.error("unsupported locationType=%s", location.type);
    return "POLYGON EMPTY";
}

function multiPolygon(coordinates: any):string {
    return ``;
}

function coordinatePair(coordinate: [number, number, number]): string {
    return `${coordinate[0]} ${coordinate[1]}`;
}