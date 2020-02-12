import apigateway = require('@aws-cdk/aws-apigateway');

const schema: apigateway.JsonSchema = {
    schema: apigateway.JsonSchemaVersion.DRAFT4,
    type: apigateway.JsonSchemaType.OBJECT,
    description: 'Extended state model for Open311 service requests',
    properties: {
        key: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Unique identifier for the state'
        },
        name: {
            type: apigateway.JsonSchemaType.STRING,
            description: "Description of the service request's state"
        }
    }
};

export default schema;