import {EndpointType, MethodLoggingLevel, RequestValidator, RestApi} from '@aws-cdk/aws-apigateway';
import {AnyPrincipal, Effect, PolicyDocument, PolicyStatement} from '@aws-cdk/aws-iam';
import {AssetCode, Function} from '@aws-cdk/aws-lambda';
import {ISecurityGroup, IVpc} from '@aws-cdk/aws-ec2';
import {Construct} from "@aws-cdk/core";
import {createEstimateSchema, LocationSchema, ShipSchema} from './model/estimate-schema';
import {createSubscription} from '../../../../common/stack/subscription';
import {corsMethodJsonResponse, defaultIntegration,} from "../../../../common/api/responses";
import {MessageModel} from "../../../../common/api/response";
import {addDefaultValidator, addServiceModel, createArraySchema, getModelReference} from "../../../../common/api/utils";
import {dbLambdaConfiguration} from "../../../../common/stack/lambda-configs";
import {Props} from "./app-props-estimates";
import {addTags} from "../../../../common/api/documentation";
import {createUsagePlan} from "../../../../common/stack/usage-plans";

export function create(
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: Props,
    stack: Construct) {
    const publicApi = createApi(stack);

    createUsagePlan(publicApi, 'Portcall estimates Api Key', 'Portcall estimates Usage Plan');

    const validator = addDefaultValidator(publicApi);

    const shipModel = addServiceModel("ShipModel", publicApi, ShipSchema);
    const locationModel = addServiceModel("LocationModel", publicApi, LocationSchema);
    const estimateModel = addServiceModel("EstimateModel",
        publicApi,
        createEstimateSchema(
            getModelReference(shipModel.modelId, publicApi.restApiId),
            getModelReference(locationModel.modelId, publicApi.restApiId)));
    const estimatesModel = addServiceModel("EstimatesModel", publicApi, createArraySchema(estimateModel, publicApi));

    createEstimatesResource(publicApi, vpc, props, lambdaDbSg, estimatesModel, validator, stack);
}

function createEstimatesResource(
    publicApi: RestApi,
    vpc: IVpc,
    props: Props,
    lambdaDbSg: ISecurityGroup,
    estimatesJsonModel: any,
    validator: RequestValidator,
    stack: Construct): Function {

    const functionName = 'PortcallEstimate-GetEstimates';
    const errorResponseModel = publicApi.addModel('MessageResponseModel', MessageModel);
    const assetCode = new AssetCode('dist/estimates/lambda/get-estimates');
    const getEstimatesLambda = new Function(stack, functionName, dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: functionName,
        code: assetCode,
        handler: 'lambda-get-estimates.handler',
        readOnly: false
    }));

    const resources = createResourcePaths(publicApi);
    const getEstimatesIntegration = defaultIntegration(getEstimatesLambda, {
        requestParameters: {
            'integration.request.querystring.locode': 'method.request.querystring.locode',
            'integration.request.querystring.mmsi': 'method.request.querystring.mmsi',
            'integration.request.querystring.imo': 'method.request.querystring.imo'
        },
        requestTemplates: {
            'application/json': JSON.stringify({
                locode: "$util.escapeJavaScript($input.params('locode'))",
                mmsi: "$util.escapeJavaScript($input.params('mmsi'))",
                imo: "$util.escapeJavaScript($input.params('imo'))"
            })
        }
    });

    resources.addMethod("GET", getEstimatesIntegration, {
        apiKeyRequired: true,
        requestParameters: {
            'method.request.querystring.locode': false,
            'method.request.querystring.mmsi': false,
            'method.request.querystring.imo': false
        },
        requestValidator: validator,
        methodResponses: [
            corsMethodJsonResponse("200", estimatesJsonModel),
            corsMethodJsonResponse("500", errorResponseModel)
        ]
    });

    createSubscription(getEstimatesLambda, functionName, props.logsDestinationArn, stack);
    addTags('GetEstimates', ['portcall-estimates'], resources, stack);

    return getEstimatesLambda;
}

function createResourcePaths(publicApi: RestApi) {
    const apiResource = publicApi.root.addResource("api");
    const v2Resource = apiResource.addResource("v2");
    return v2Resource.addResource("portcall-estimates");
}

function createApi(stack: Construct) {
    return new RestApi(stack, 'PortcallEstimate-public', {
        deployOptions: {
            loggingLevel: MethodLoggingLevel.ERROR,
        },
        description: 'Portcall estimates',
        restApiName: 'PortcallEstimates public API',
        endpointTypes: [EndpointType.REGIONAL],
        policy: new PolicyDocument({
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        "execute-api:Invoke"
                    ],
                    resources: [
                        "*"
                    ],
                    principals: [
                        new AnyPrincipal()
                    ]
                })
            ]
        })
    });
}
