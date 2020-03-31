import {ServiceRequestWithExtensionsDto, ServiceRequestStatus, ServiceRequestWithExtensions} from "../../lib/model/service-request";
import {Service, ServiceType} from "../../lib/model/service";
import {toServiceRequestWithExtensions} from "../../lib/service/requests";
import {ServiceRequestState} from "../../lib/model/service-request-state";

export function newService(): Service {
    return {
      service_code: Math.random().toFixed(3).split('.')[1],
      service_name: 'some name',
      keywords: 'some, words',
      description: 'some description',
      type: ServiceType.batch,
      metadata: false,
      group: 'some group'
    };
}

export function newServiceRequest(status: ServiceRequestStatus = ServiceRequestStatus.open): ServiceRequestWithExtensions {
    const requested_datetime = new Date();
    requested_datetime.setMilliseconds(0);
    const updated_datetime = new Date();
    updated_datetime.setMilliseconds(0);
    const expected_datetime = new Date();
    expected_datetime.setMilliseconds(0);
    return {
        service_request_id: "SRQ" + Math.random().toFixed(10).split('.')[1],
        status: status,
        status_notes: "status_notes",
        service_name: "service_name",
        service_code: "123",
        description: "some description",
        agency_responsible: "some agency",
        service_notice: "some notice",
        requested_datetime,
        updated_datetime,
        expected_datetime,
        address: "some address",
        address_id: "2",
        zipcode: "123456",
        long: 1,
        lat: 2,
        media_url: "some url",
        status_id: '123',
        title: 'some title',
        service_object_id: 'some service_object_id',
        service_object_type: 'some service_object_type',
        media_urls: ['http://example.com', 'http://example.net']
    };
}

export function newState(): ServiceRequestState {
    return {
      key: Math.random().toFixed(3).split('.')[1],
      name: Math.random().toFixed(10).split('.')[1]
    };
}

export function newServiceRequestWithExtensionsDto(status: ServiceRequestStatus = ServiceRequestStatus.open): ServiceRequestWithExtensionsDto {
    return toServiceRequestWithExtensions(newServiceRequest(status));
}