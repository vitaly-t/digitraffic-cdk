import {ServiceRequestStatus, ServiceRequestWithExtensions} from "../model/service-request";
import {IDatabase, PreparedStatement} from "pg-promise";

const DELETE_REQUEST_PS = new PreparedStatement({
    name: 'delete-request-by-id',
    text: 'DELETE FROM open311_service_request WHERE service_request_id = $1'
});

const UPSERT_REQUEST_PS = new PreparedStatement({
    name: 'upsert-request-by-id',
    text: `INSERT INTO open311_service_request(
                            service_request_id,
                            status,
                            status_notes,
                            service_name,
                            service_code,
                            description,
                            agency_responsible,
                            service_notice,
                            requested_datetime,
                            updated_datetime,
                            expected_datetime,
                            address,
                            address_id,
                            zipcode,
                            geometry,
                            media_url,
                            status_id,
                            vendor_status,
                            title,
                            service_object_id,
                            service_object_type,
                            media_urls)
                         VALUES ($1,
                                 $2,
                                 $3,
                                 $4,
                                 $5,
                                 $6,
                                 $7,
                                 $8,
                                 $9,
                                 $10,
                                 $11,
                                 $12,
                                 $13,
                                 $14,
                                 (CASE WHEN $15::numeric IS NOT NULL AND $16::numeric IS NOT NULL THEN ST_POINT($15::numeric, $16::numeric) ELSE NULL END),
                                 $17,
                                 $18,
                                 $19,
                                 $20,
                                 $21,
                                 $22,
                                 $23)
                         ON CONFLICT (service_request_id) DO UPDATE SET
                                 status_notes = $3,
                                 service_name = $4,
                                 service_code = $5,
                                 description = $6,
                                 agency_responsible = $7,
                                 service_notice = $8,
                                 requested_datetime = $9,
                                 updated_datetime = $10,
                                 expected_datetime = $11,
                                 address = $12,
                                 address_id = $13,
                                 zipcode = $14,
                                 geometry = (CASE WHEN $15::numeric IS NOT NULL AND $16::numeric IS NOT NULL THEN ST_POINT($15::numeric, $16::numeric) ELSE NULL END),
                                 media_url = $17,
                                 status_id = $18,
                                 vendor_status = $19,
                                 title = $20,
                                 service_object_id = $21,
                                 service_object_type = $22,
                                 media_urls = $23
                    `
});

interface ServiceRequestServiceCode {
    readonly service_code: string | null;
}

interface ServiceRequestStatusId {
    readonly status_id: string | null;
}

export function findServiceCodes(db: IDatabase<any, any>): Promise<ServiceRequestServiceCode[]> {
    return db.manyOrNone("SELECT DISTINCT service_code FROM open311_service_request");
}

export function findStateIds(db: IDatabase<any, any>): Promise<ServiceRequestStatusId[]> {
    return db.manyOrNone("SELECT status_id FROM open311_service_request");
}

export function findSubjectIds(db: IDatabase<any, any>): Promise<ServiceRequestStatusId[]> {
    return db.manyOrNone("SELECT DISTINCT status_id FROM open311_service_request");
}

export function findAll(db: IDatabase<any, any>): Promise<ServiceRequestWithExtensions[]> {
    return db.manyOrNone(`${SELECT_REQUEST} ORDER BY service_request_id`).then(requests => requests.map(r => toServiceRequest(r)));
}

export function find(
    service_request_id: string,
    db: IDatabase<any, any>
): Promise<ServiceRequestWithExtensions | null > {
    const ps = new PreparedStatement({
        name: 'find-service-request-by-id',
        text: `${SELECT_REQUEST} WHERE service_request_id = $1`,
        values: [service_request_id]
    });
    return db.oneOrNone(ps).then(r => r == null ? null : toServiceRequest(r));
}

export function update(
    serviceRequests: ServiceRequestWithExtensions[],
    db: IDatabase<any, any>
): Promise<void> {
    return db.tx(t => {
        const queries: any[] = serviceRequests.map(serviceRequest => {
            if (serviceRequest.status == ServiceRequestStatus.closed) {
                return t.none(DELETE_REQUEST_PS, [serviceRequest.service_request_id]);
            } else {
                return t.none(UPSERT_REQUEST_PS, createEditObject(serviceRequest));
            }
        });
        return t.batch(queries);
    });
}

export function doDelete(
    serviceRequestId: string,
    db: IDatabase<any, any>
) {
    return db.tx(t => {
        return t.none('DELETE FROM open311_service_request WHERE service_request_id = $1', serviceRequestId);
    });
}

const SELECT_REQUEST = `SELECT service_request_id,
                               status,
                               status_notes,
                               service_name,
                               service_code,
                               description,
                               agency_responsible,
                               service_notice,
                               requested_datetime,
                               updated_datetime,
                               expected_datetime,
                               address,
                               address_id,
                               zipcode,
                               ST_X(geometry) AS long,
                               ST_Y(geometry) AS lat,
                               media_url,
                               status_id,
                               vendor_status,
                               title,
                               service_object_id,
                               service_object_type,
                               media_urls
                        FROM open311_service_request`;

function toServiceRequest(r: any): ServiceRequestWithExtensions {
    return {
        service_request_id: r.service_request_id,
        status: r.status,
        status_notes: r.status_notes,
        service_name: r.service_name,
        service_code: r.service_code,
        description: r.description,
        agency_responsible: r.agency_responsible,
        service_notice: r.service_notice,
        requested_datetime: r.requested_datetime,
        updated_datetime: r.updated_datetime,
        expected_datetime: r.expected_datetime,
        address: r.address,
        address_id: r.address_id,
        zipcode: r.zipcode,
        long: r.long,
        lat: r.lat,
        media_url: r.media_url,
        status_id: r.status_id,
        vendor_status: r.vendor_status,
        title: r.title,
        service_object_id: r.service_object_id,
        service_object_type: r.service_object_type,
        media_urls: r.media_urls
    };
}

/**
 * Creates an object with all necessary properties for pg-promise
 */
export function createEditObject(serviceRequest: ServiceRequestWithExtensions): any[] {
    const editObject = { ...{
        status_notes: null,
        service_name: null,
        service_code: null,
        agency_responsible: null,
        service_notice: null,
        updated_datetime: null,
        expected_datetime: null,
        address: null,
        address_id: null,
        zipcode: null,
        long: null,
        lat: null,
        media_url: null,
        status_id: null,
        vendor_status: null,
        title: null,
        service_object_id: null,
        service_object_type: null,
        media_urls: null
    }, ...serviceRequest };

    // DPO-1167 handle long/lat empty string
    // @ts-ignore
    const editObjectWithLonLat = serviceRequest.long != '' && serviceRequest.lat != '' ? editObject : { ...serviceRequest, ...{
            long: null,
            lat: null
        }
    };

    // ordering is important!
    const ret = [];
    ret.push(editObjectWithLonLat.service_request_id);
    ret.push(editObjectWithLonLat.status);
    ret.push(editObjectWithLonLat.status_notes);
    ret.push(editObjectWithLonLat.service_name);
    ret.push(editObjectWithLonLat.service_code);
    ret.push(editObjectWithLonLat.description);
    ret.push(editObjectWithLonLat.agency_responsible);
    ret.push(editObjectWithLonLat.service_notice);
    ret.push(editObjectWithLonLat.requested_datetime);
    ret.push(editObjectWithLonLat.updated_datetime);
    ret.push(editObjectWithLonLat.expected_datetime);
    ret.push(editObjectWithLonLat.address);
    ret.push(editObjectWithLonLat.address_id);
    ret.push(editObjectWithLonLat.zipcode);
    ret.push(editObjectWithLonLat.long);
    ret.push(editObjectWithLonLat.lat);
    ret.push(editObjectWithLonLat.media_url);
    ret.push(editObjectWithLonLat.status_id);
    ret.push(editObjectWithLonLat.vendor_status);
    ret.push(editObjectWithLonLat.title);
    ret.push(editObjectWithLonLat.service_object_id);
    ret.push(editObjectWithLonLat.service_object_type);
    ret.push(editObjectWithLonLat.media_urls);

    return ret;
}
