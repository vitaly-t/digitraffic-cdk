import * as pgPromise from "pg-promise";
import {Annotation,Location} from "../model/annotations";

const FIND_ALL_SQL = "select id, author, created_at, recorded_at, expires_at, type, location from nw2_annotation";
const FIND_ALL_ACTIVE_SQL = "select id, author, created_at, recorded_at, expires_at, type, location from nw2_annotation " +
    "where expires_at is null or expires_at > current_timestamp";

const UPSERT_ANNOTATIONS_SQL = "insert into nw2_annotation(id, author, created_at, recorded_at, expires_at, type, location)" +
    "values(${id},${author},${created_at},${recorded_at},${expires_at},${type},${geometry}) " +
    "on conflict (id) " +
    "do update set " +
    "   expires_at = ${expires_at}," +
    "   location = ${geometry}";

export function updateAnnotations(db: pgPromise.IDatabase<any, any>, annotations: Annotation[]): Promise<any>[] {
    let promises: any[] = [];

    annotations.forEach(a => {
        promises.push(db.none(UPSERT_ANNOTATIONS_SQL, {
            id: a._id,
            author: a.author,
            created_at: a.created_at,
            recorded_at: a.recorded_at,
            expires_at: a.expires_at,
            type: a.tags == null ? null : a.tags[0].split(":", 2)[1],
            geometry: createGeometry(a.location)
        }));
    });

    return promises;
}

export async function findAllActive(db: pgPromise.IDatabase<any, any>): Promise<any[]> {
    return await db.manyOrNone(FIND_ALL_ACTIVE_SQL);
}

export async function findAll(db: pgPromise.IDatabase<any, any>): Promise<any[]> {
    return await db.manyOrNone(FIND_ALL_SQL);
}

function createGeometry(location: Location): string {
//    console.info("location:" + JSON.stringify(location));

    if(location.type == 'LineString') {
        const coordinates = location.coordinates.map((c: any) =>  coordinatePair(c)).join(',');

        return `LINESTRING(${coordinates})`;
    } else if (location.type == 'Point') {
        const coordinates = coordinatePair(location.coordinates);

        return `POINT(${coordinates})`;
    }

    console.error("unsupported locationType=", location.type);
    return "";
}

function coordinatePair(coordinate: [number, number, number]) {
    return `${coordinate[0]} ${coordinate[1]}`;
}