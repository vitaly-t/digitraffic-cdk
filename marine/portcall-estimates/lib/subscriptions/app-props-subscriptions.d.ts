import {Duration} from "@aws-cdk/core";

export interface Props {
    vpcId: string;
    privateSubnetIds: string[];
    availabilityZones: string[];
    lambdaDbSgId: string;
    dbProps: DbProps;
    defaultLambdaDurationSeconds: number;
    logsDestinationArn: string;
    sqsProcessLambdaConcurrentExecutions: number;
    pinpointApplicationId: string;
    pinpointTelephoneNumber: string;
}
export interface DbProps {
    username: string;
    password: string;
    uri: string;
    ro_uri: string;
}
