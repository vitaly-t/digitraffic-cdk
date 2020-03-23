import {CfnWebACL} from '@aws-cdk/aws-wafv2';
import {Stack} from '@aws-cdk/core';

export enum AclRuleType {
    AWSCommonRuleSet, AWSReputationList, AWSKnownBadInputs, ThrottleRule, GzipHeaderRule
}

export function createWebAcl(stack: Stack, rules: AclRuleType[]): CfnWebACL {
    const generatedRules = rules.map(createRule);

    return new CfnWebACL(stack, 'DefaultWebAcl', {
        defaultAction: {allow: {}},
        scope: 'CLOUDFRONT',
        visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "WAF-Blocked",
            sampledRequestsEnabled: false,
        },
        rules: generatedRules
    });
}

function createRule(rule: AclRuleType) {
    if(rule == AclRuleType.AWSCommonRuleSet) {
        return {
            name: "AWS-AWSManagedRulesCommonRuleSet",
            priority: 0,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesCommonRuleSet"
                }
            },
            overrideAction: {
                none: {}
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesCommonRuleSet"
            }
        }
    } else if(rule == AclRuleType.AWSReputationList) {
        return {
            name: "AWS-AWSManagedRulesAmazonIpReputationList",
            priority: 1,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesAmazonIpReputationList"
                }
            },
            overrideAction: {
                none: {}
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesAmazonIpReputationList"
            }
        }
    } else if(rule == AclRuleType.AWSKnownBadInputs) {
        return {
            name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            priority: 2,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesKnownBadInputsRuleSet"
                }
            },
            overrideAction: {
                none: {}
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet"
            }
        }
    } else if(rule == AclRuleType.ThrottleRule) {
        return {
            name: "ThrottleRule",
            priority: 3,
            action: { block: {} },
            statement: {
                rateBasedStatement: {
                    aggregateKeyType: 'IP',
                    limit: 100
                }
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "ThrottleRule"
            }
        }
    } else if(rule == AclRuleType.GzipHeaderRule) {
        return {
            name: "GzipRule",
            priority: 4,
            action: { block: {} },
            statement: {
                notStatement: {
                    statement: {
                        byteMatchStatement: {
                            fieldToMatch: {
                                singleHeader: {
                                    name: 'accept-encoding'
                                }
                            },
                            positionalConstraint: 'CONTAINS',
                            searchString: 'gzip',
                            textTransformations: [
                                {type: 'LOWERCASE', priority: 0}
                            ]
                        }
                    }
                }
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "GzipRule"
            }
        }
    }

    throw new TypeError();
}

