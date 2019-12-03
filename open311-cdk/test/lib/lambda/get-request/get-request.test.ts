import * as pgPromise from "pg-promise";
import {initDb} from 'digitraffic-lambda-postgres/database';
import {handler} from "../../../../lib/lambda/get-request/lambda-get-request";
import {newServiceRequest} from "../../testdata";
import {ServiceRequestStatus} from "../../../../lib/model/service-request";
import {insert} from "../../../../lib/db/db-requests";
const testEvent = require('../../test-event');

var db: pgPromise.IDatabase<any, any>;

beforeAll(() => {
   db = initDb('road', 'road', 'localhost:54322/road');
   process.env.DB_USER = 'road';
   process.env.DB_PASS = 'road';
   process.env.DB_URI = 'localhost:54322/road';
});

afterAll(() => {
    db.none('DELETE FROM open311_service_request');
    db.$pool.end();
});

beforeEach(() => {
    db.none('DELETE FROM open311_service_request');
});

test('No request_id - invalid request', async () => {
    const response = await handler(Object.assign({}, testEvent, {
        pathParameters: {},
        body: JSON.stringify(newServiceRequest())
    }));

    expect(response.statusCode).toBe(400);
});

test('Get', async () => {
    const sr = Object.assign(newServiceRequest(), {
        status: ServiceRequestStatus.open
    });
    await insert(db, [sr]);

    const response = await handler(Object.assign({}, testEvent, {
        pathParameters: {request_id: sr.service_request_id}
    }));

    expect(response.statusCode).toBe(200);
});