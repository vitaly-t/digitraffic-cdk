import {Rule,Schedule} from '@aws-cdk/aws-events';
import {Function,AssetCode} from '@aws-cdk/aws-lambda';
import {IVpc,ISecurityGroup} from '@aws-cdk/aws-ec2';
import {LambdaFunction} from '@aws-cdk/aws-events-targets';
import {Stack, Duration} from '@aws-cdk/core';
import {dbLambdaConfiguration} from './cdk-util';
import {createSubscription} from '../../common/stack/subscription';

export function create(
    vpc: IVpc,
    lambdaDbSg: ISecurityGroup,
    props: NavaidFaultsProps,
    stack: Stack): Function {

    const functionName = "NAF-UpdateFaults";
    const lambdaConf = dbLambdaConfiguration(vpc, lambdaDbSg, props, {
        functionName: functionName,
        code: new AssetCode('dist/lambda/update-faults'),
        handler: 'lambda-update-faults.handler'
    });

    const updateFaultsLambda = new Function(stack, 'UpdateFaults', lambdaConf);

    const rule = new Rule(stack, 'Rule', {
        schedule: Schedule.rate(Duration.minutes(10))
    });
    rule.addTarget(new LambdaFunction(updateFaultsLambda));

    createSubscription(updateFaultsLambda, functionName, props.logsDestinationArn, stack);

    return updateFaultsLambda;
}
