import apigateway = require('@aws-cdk/aws-apigateway');
import iam = require('@aws-cdk/aws-iam');
import * as lambda from '@aws-cdk/aws-lambda';
import * as ec2 from '@aws-cdk/aws-ec2';
import {EndpointType} from "@aws-cdk/aws-apigateway";
import {Construct, Stack} from "@aws-cdk/core";
import {dbLambdaConfiguration} from '../../../common/stack/lambda-configs';
import {default as ServiceSchema} from './model/service-schema';
import {default as RequestSchema} from './model/request-schema';
import {default as StateSchema} from './model/state-schema';
import {default as SubjectSchema} from './model/subject-schema';
import {default as SubSubjectSchema} from './model/subsubject-schema';
import {MessageModel} from 'digitraffic-cdk-api/response';
import {addDefaultValidator, addServiceModel, createArraySchema} from 'digitraffic-cdk-api/utils';
import {createSubscription} from "../../../common/stack/subscription";
import {createUsagePlan} from "../../../common/stack/usage-plans";
import {corsMethodJsonResponse, defaultIntegration, defaultSingleResourceIntegration} from "../../../common/api/responses";
import {addTags} from "../../../common/api/documentation";
import {DATA_V1_TAGS} from "../../../common/api/tags";

export function create(
    vpc: ec2.IVpc,
    lambdaDbSg: ec2.ISecurityGroup,
    stack: Stack,
    props: Props) {

    const publicApi = createApi(stack);

    createUsagePlan(publicApi, 'Open311 CloudFront API Key', 'Open311 CloudFront Usage Plan');

    const validator = addDefaultValidator(publicApi);

    const requestModel = addServiceModel('RequestModel', publicApi, RequestSchema);
    const requestsModel = addServiceModel('RequestsModel', publicApi, createArraySchema(requestModel, publicApi));
    const stateModel = addServiceModel('StateModel', publicApi, StateSchema);
    const subjectModel = addServiceModel('SubjectModel', publicApi, SubjectSchema);
    const subSubjectModel = addServiceModel('SubSubjectModel', publicApi, SubSubjectSchema);
    const serviceModel = addServiceModel('ServiceModel', publicApi, ServiceSchema);
    const servicesModel = addServiceModel('ServicesModel', publicApi, createArraySchema(serviceModel, publicApi));
    const messageResponseModel = publicApi.addModel('MessageResponseModel', MessageModel);

    const apiResource = publicApi.root.addResource("api");
    const v1Resource = apiResource.addResource("v1");
    const open311Resource = v1Resource.addResource("open311");

    createRequestsResource(open311Resource,
        vpc,
        props,
        lambdaDbSg,
        requestModel,
        requestsModel,
        messageResponseModel,
        validator,
        stack);
    createStatesResource(open311Resource,
        vpc,
        props,
        lambdaDbSg,
        stateModel,
        messageResponseModel,
        validator,
        stack);
    createSubjectsResource(open311Resource,
        vpc,
        props,
        lambdaDbSg,
        subjectModel,
        messageResponseModel,
        validator,
        stack);
    createSubSubjectsResource(open311Resource,
        vpc,
        props,
        lambdaDbSg,
        subSubjectModel,
        messageResponseModel,
        validator,
        stack);
    createServicesResource(open311Resource,
        vpc,
        props,
        lambdaDbSg,
        serviceModel,
        servicesModel,
        messageResponseModel,
        validator,
        stack);
}

function createRequestsResource(
    open311Resource: apigateway.Resource,
    vpc: ec2.IVpc,
    props: Props,
    lambdaDbSg: ec2.ISecurityGroup,
    requestModel: apigateway.Model,
    requestsModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const requests = open311Resource.addResource("requests");

    const getRequestsId = 'GetRequests';
    const getRequestsHandler = new lambda.Function(stack, getRequestsId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getRequestsId,
        code: new lambda.AssetCode('dist/lambda/get-requests'),
        handler: 'lambda-get-requests.handler'
    }));
    createSubscription(getRequestsHandler, getRequestsId, props.logsDestinationArn, stack);
    createGetRequestsIntegration(getRequestsId,
        requests,
        getRequestsHandler,
        requestsModel,
        messageResponseModel,
        stack);

    const getRequestId = 'GetRequest';
    const getRequestHandler = new lambda.Function(stack, getRequestId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getRequestId,
        code: new lambda.AssetCode('dist/lambda/get-request'),
        handler: 'lambda-get-request.handler'
    }));
    createSubscription(getRequestHandler, getRequestId, props.logsDestinationArn, stack);
    createGetRequestIntegration(getRequestsId,
        requests,
        getRequestHandler,
        requestModel,
        messageResponseModel,
        validator,
        stack);
}

function createGetRequestIntegration(
    getRequestsId: string,
    requests: apigateway.Resource,
    getRequestHandler: lambda.Function,
    requestModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const getRequestIntegration = defaultSingleResourceIntegration(getRequestHandler, {
        requestParameters: {
            'integration.request.path.request_id': 'method.request.path.request_id',
            'integration.request.querystring.extensions': 'method.request.querystring.extensions'
        },
        requestTemplates: {
            'application/json': JSON.stringify({
                request_id: "$util.escapeJavaScript($input.params('request_id'))",
                extensions: "$util.escapeJavaScript($input.params('extensions'))"
            })
        }
    });
    const request = requests.addResource("{request_id}");
    request.addMethod("GET", getRequestIntegration, {
        apiKeyRequired: true,
        requestValidator: validator,
        requestParameters: {
            'method.request.path.request_id': true,
            'method.request.querystring.extensions': false
        },
        methodResponses: [
            corsMethodJsonResponse("200", requestModel),
            corsMethodJsonResponse("404", messageResponseModel),
            corsMethodJsonResponse("500", messageResponseModel)
        ]
    });
    addTags('GetRequest', DATA_V1_TAGS, request, stack);
}

function createGetRequestsIntegration(
    getRequestsId: string,
    requests: apigateway.Resource,
    getRequestsHandler: lambda.Function,
    requestsModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    stack: Construct) {

    const getRequestsIntegration = defaultIntegration(getRequestsHandler, {
        requestParameters: {
            'integration.request.querystring.extensions': 'method.request.querystring.extensions'
        }, requestTemplates: {
            'application/json': JSON.stringify({
                extensions: "$util.escapeJavaScript($input.params('extensions'))"
            })
        }
    });
    requests.addMethod("GET", getRequestsIntegration, {
        apiKeyRequired: true,
        requestParameters: {
            'method.request.querystring.extensions': false
        },
        methodResponses: [
            corsMethodJsonResponse("200", requestsModel),
            corsMethodJsonResponse("500", messageResponseModel)
        ]
    });
    addTags('GetRequests', DATA_V1_TAGS, requests, stack);
}

function createStatesResource(
    open311Resource: apigateway.Resource,
    vpc: ec2.IVpc,
    props: Props,
    lambdaDbSg: ec2.ISecurityGroup,
    stateModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const states = open311Resource.addResource("states");

    const getStatesId = 'GetStates';
    const getStatesHandler = new lambda.Function(stack, getStatesId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getStatesId,
        code: new lambda.AssetCode('dist/lambda/get-states'),
        handler: 'lambda-get-states.handler'
    }));
    createSubscription(getStatesHandler, getStatesId, props.logsDestinationArn, stack);
    createGetResourcesIntegration(states,
        getStatesHandler,
        stateModel,
        messageResponseModel,
        'GetStates',
        stack);
}

function createSubjectsResource(
    open311Resource: apigateway.Resource,
    vpc: ec2.IVpc,
    props: Props,
    lambdaDbSg: ec2.ISecurityGroup,
    subjectModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const subjects = open311Resource.addResource("subjects");
    const getSubjectsId = 'Open311-GetSubjects';
    const getSubjectsHandler = new lambda.Function(stack, getSubjectsId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getSubjectsId,
        code: new lambda.AssetCode('dist/lambda/get-subjects'),
        handler: 'lambda-get-subjects.handler'
    }));
    createSubscription(getSubjectsHandler, getSubjectsId, props.logsDestinationArn, stack);
    createGetSubjectsIntegration('GetSubjects',
        subjects,
        getSubjectsHandler,
        subjectModel,
        messageResponseModel,
        stack);
}

function createSubSubjectsResource(
    open311Resource: apigateway.Resource,
    vpc: ec2.IVpc,
    props: Props,
    lambdaDbSg: ec2.ISecurityGroup,
    subSubjectModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const subSubjects = open311Resource.addResource("subsubjects");
    const getSubSubjectsId = 'Open311-GetSubSubjects';
    const getSubSubjectsHandler = new lambda.Function(stack, getSubSubjectsId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getSubSubjectsId,
        code: new lambda.AssetCode('dist/lambda/get-subsubjects'),
        handler: 'lambda-get-subsubjects.handler'
    }));
    createSubscription(getSubSubjectsHandler, getSubSubjectsId, props.logsDestinationArn, stack);
    createGetSubjectsIntegration('GetSubSubjects',
        subSubjects,
        getSubSubjectsHandler,
        subSubjectModel,
        messageResponseModel,
        stack);
}

function createServicesResource(
    open311Resource: apigateway.Resource,
    vpc: ec2.IVpc,
    props: Props,
    lambdaDbSg: ec2.ISecurityGroup,
    serviceModel: apigateway.Model,
    servicesModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {

    const services = open311Resource.addResource("services");

    const getServicesId = 'GetServices';
    const getServicesHandler = new lambda.Function(stack, getServicesId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getServicesId,
        code: new lambda.AssetCode('dist/lambda/get-services'),
        handler: 'lambda-get-services.handler'
    }));
    createSubscription(getServicesHandler, getServicesId, props.logsDestinationArn, stack);
    createGetResourcesIntegration(
        services,
        getServicesHandler,
        servicesModel,
        messageResponseModel,
        'GetServices',
        stack);

    const getServiceId = 'GetService';
    const getServiceHandler = new lambda.Function(stack, getServiceId, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: getServiceId,
        code: new lambda.AssetCode('dist/lambda/get-service'),
        handler: 'lambda-get-service.handler'
    }));
    createSubscription(getServiceHandler, getServiceId, props.logsDestinationArn, stack);
    createGetServiceIntegration(getServiceId,
        services,
        getServiceHandler,
        serviceModel,
        messageResponseModel,
        validator,
        stack);
}

function createGetResourcesIntegration(
    resource: apigateway.Resource,
    handler: lambda.Function,
    model: apigateway.Model,
    messageResponseModel: apigateway.Model,
    tag: string,
    stack: Construct) {

    const integration = defaultIntegration(handler);
    resource.addMethod("GET", integration, {
        apiKeyRequired: true,
        methodResponses: [
            corsMethodJsonResponse("200", model),
            corsMethodJsonResponse("500", messageResponseModel)
        ]
    });
    addTags(tag, DATA_V1_TAGS, resource, stack);
}

function createGetSubjectsIntegration(
    id: string,
    resource: apigateway.Resource,
    handler: lambda.Function,
    model: apigateway.Model,
    messageResponseModel: apigateway.Model,
    stack: Construct) {

    const integration = defaultIntegration(handler, {
        requestParameters: {
            'integration.request.querystring.locale': 'method.request.querystring.locale'
        }, requestTemplates: {
            'application/json': JSON.stringify({
                locale: "$util.escapeJavaScript($input.params('locale'))"
            })
        }
    });
    resource.addMethod("GET", integration, {
        apiKeyRequired: true,
        requestParameters: {
            'method.request.querystring.locale': false
        },
        methodResponses: [
            corsMethodJsonResponse("200", model),
            corsMethodJsonResponse("500", messageResponseModel)
        ]
    });
    addTags(id, DATA_V1_TAGS, resource, stack);
}

function createGetServiceIntegration(
    getServiceId: string,
    services: apigateway.Resource,
    getServiceHandler: lambda.Function,
    serviceModel: apigateway.Model,
    messageResponseModel: apigateway.Model,
    validator: apigateway.RequestValidator,
    stack: Construct) {
    const getServiceIntegration = defaultSingleResourceIntegration(getServiceHandler, {
        requestParameters: {
            'integration.request.path.service_id': 'method.request.path.service_id'
        }, requestTemplates: {
            'application/json': JSON.stringify({service_id: "$util.escapeJavaScript($input.params('service_id'))"})
        }
    });
    const service = services.addResource("{service_id}");
    service.addMethod("GET", getServiceIntegration, {
        apiKeyRequired: true,
        requestValidator: validator,
        requestParameters: {
            'method.request.path.service_id': true
        },
        methodResponses: [
            corsMethodJsonResponse("200", serviceModel),
            corsMethodJsonResponse("404", messageResponseModel),
            corsMethodJsonResponse("500", messageResponseModel)
        ]
    });
    addTags('GetService', DATA_V1_TAGS, service, stack);
}

function createApi(stack: Construct) {
    return new apigateway.RestApi(stack, 'Open311-public', {
        defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS
        },
        endpointExportName: 'Open311publicEndpoint',
        deployOptions: {
            loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        },
        restApiName: 'Open311 public API',
        endpointTypes: [EndpointType.REGIONAL],
        policy: new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "execute-api:Invoke"
                    ],
                    resources: [
                        "*"
                    ],
                    principals: [
                        new iam.AnyPrincipal()
                    ]
                })
            ]
        })
    });
}