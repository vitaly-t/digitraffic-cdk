import apigateway = require('@aws-cdk/aws-apigateway');

const disruptionsProperties: apigateway.JsonSchema = {
    schema: apigateway.JsonSchemaVersion.DRAFT4,
    type: apigateway.JsonSchemaType.OBJECT,
    description: 'Bridge and lock Disruptions GeoJSON',
    properties: {
        Id: {
            type: apigateway.JsonSchemaType.NUMBER,
            description: 'Id of disruption'
        },
        Type_Id: {
            type: apigateway.JsonSchemaType.NUMBER,
            description: 'Id of disruption type'
        },
        StartDate: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Disruption started date time'
        },
        EndDate: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Disruption ended date time'
        },
        DescriptionFi: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Disruption description, finnish'
        },
        DescriptionSv: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Disruption description, swedish'
        },
        DescriptionEn: {
            type: apigateway.JsonSchemaType.STRING,
            description: 'Disruption description, english'
        }
    }
};

export default disruptionsProperties;
