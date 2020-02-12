import apigateway = require('@aws-cdk/aws-apigateway');

export function getModelReference(modelId: string, restApiId: string) {
    return `https://apigateway.amazonaws.com/restapis/${restApiId}/models/${modelId}`;
}

export function addDefaultValidator(api: apigateway.RestApi): any {
    return api.addRequestValidator('DefaultValidator', {
        validateRequestParameters: true,
        validateRequestBody: true
    });
}

export function addServiceModel(name:string, api: apigateway.RestApi, schema: apigateway.JsonSchema): any {
    return api.addModel(name, {
        contentType: 'application/json',
        modelName: name,
        schema: schema
    });
}

export function createArraySchema(model:any, api: apigateway.RestApi): any {
    return {
        type: apigateway.JsonSchemaType.ARRAY,
        items: {
            ref: getModelReference(model.modelId, api.restApiId)
        }
    };
}