import "source-map-support/register";
import {
    Context,
    KinesisStreamEvent,
    KinesisStreamRecord,
    CloudWatchLogsDecodedData
} from "aws-lambda";

import * as AWSx from "aws-sdk";
const AWS = AWSx as any;
const zlib = require("zlib");

export const handler = (event: KinesisStreamEvent, context: Context, callback: any): void => {
    const esDomain = {
        region: process.env.AWS_REGION as string,
        endpoint: process.env.ES_ENDPOINT
    };

    const knownAccounts: Account[] = JSON.parse(process.env.KNOWN_ACCOUNTS as string);

    const endpoint = new AWS.Endpoint(esDomain.endpoint);

    event.Records.forEach(function(record: KinesisStreamRecord) {
        let zippedInput = Buffer.from(record.kinesis.data, "base64");

        // decompress the input
        zlib.gunzip(zippedInput, function(error: any, buffer: any) {
            if (error) {
                context.fail(error);
                return;
            }

            // parse the input from JSON
            let awslogsData: CloudWatchLogsDecodedData = JSON.parse(
                buffer.toString("utf8")
            );

            // transform the input to Elasticsearch documents
            let elasticsearchBulkData = transform(awslogsData, knownAccounts);

            // skip control messages
            if (!elasticsearchBulkData) {
                console.log("Received a control message");
                context.succeed("Control message handled successfully");
                return;
            }
            postToES(endpoint,
                esDomain.region,
                elasticsearchBulkData,
                callback);
        });
    });
};

export function postToES(
    endpoint: AWS.Endpoint,
    esRegion: string,
    doc: string,
    callback: any) {
    const creds = new AWS.EnvironmentCredentials("AWS")
    let req = new AWS.HttpRequest(endpoint);

    req.method = "POST";
    req.path = "/_bulk?pipeline=keyval";
    req.region = esRegion;
    req.headers["presigned-expires"] = false;
    req.headers["Host"] = endpoint.host;
    req.body = doc;
    req.headers["Content-Type"] = "application/json";

    let signer = new AWS.Signers.V4(req, "es");
    signer.addAuthorization(creds, new Date());

    let send = new AWS.NodeHttpClient();
    send.handleRequest(
        req,
        null,
        function(httpResp: any) {
            let respBody = "";
            httpResp.on("data", function(chunk: any) {
                respBody += chunk;
            });
            httpResp.on("end", function(chunk: any) {
                console.log("Response: " + respBody);
                callback(null);
            });
        },
        function(err: any) {
            console.log("Error: " + err);
            callback(Error(err));
        }
    );
}

export function transform(payload: CloudWatchLogsDecodedData, knownAccounts: Account[]): string | null {
    if (payload.messageType === "CONTROL_MESSAGE") {
        return null;
    }

    let bulkRequestBody = "";

    payload.logEvents.forEach(logEvent => {
        if (isLambdaLifecycleEvent(logEvent.message)) {
            return;
        }

        const app = getAppFromSenderAccount(payload.owner, knownAccounts);
        const env = getEnvFromSenderAccount(payload.owner, knownAccounts);
        const timestamp = new Date(1 * logEvent.timestamp);
        const year = timestamp.getUTCFullYear();
        const month = ("0" + (timestamp.getUTCMonth() + 1)).slice(-2);
        const indexAppName = `${app}-${env}-lambda`;

        const indexName = `${indexAppName}-${year}.${month}`;

        const messageParts = logEvent.message.split("\t"); // timestamp, id, level, message

        let source = buildSource(logEvent.message, logEvent.extractedFields) as any;
        source["@id"] = logEvent.id;
        source["@timestamp"] = new Date(1 * logEvent.timestamp).toISOString();
        source["level"] = messageParts[2];
        source["message"] = messageParts[3];
        source["@log_group"] = payload.logGroup;
        source["@app"] = indexAppName;
        source["fields"] = {app: indexAppName};
        source["@transport_type"] = app;

        let action = { index: { _id: logEvent.id, _index: null } } as any;
        action.index._index = indexName;
        action.index._type = 'doc';

        bulkRequestBody +=
            [JSON.stringify(action), JSON.stringify(source)].join("\n") + "\n";
    });
    return bulkRequestBody;
}

export function isLambdaLifecycleEvent(message: string) {
    return message.startsWith('START RequestId') || message.startsWith('END RequestId') || message.startsWith('REPORT RequestId');
}

export function buildSource(message: string, extractedFields: { [key: string]: string } | undefined): any {
    let jsonSubString: any;

    message = message.replace("[, ]", "[0.0,0.0]")
    message = message
        .replace(/\n/g, "\\n")
        .replace(/\'/g, "\\'")
        .replace(/\"/g, '\\"')
        .replace(/\&/g, "\\&")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/\b/g, "\\b")
        .replace(/\f/g, "\\f");

    if (extractedFields) {
        let source = new Array() as any;

        for (let key in extractedFields) {
            if (extractedFields.hasOwnProperty(key) && extractedFields[key]) {
                let value = extractedFields[key];

                if (isNumeric(value)) {
                    source[key] = 1 * (value as any);
                    continue;
                }

                jsonSubString = extractJson(value);
                if (jsonSubString !== null) {
                    source["$" + key] = JSON.parse(jsonSubString);
                }

                source[key] = value;
            }
        }
        source.message = message;
        return source;
    }
    message = message.replace("[, ]", "[0.0,0.0]");
    message = message
        .replace(/\\n/g, "\\n")
        .replace(/\\'/g, "\\'")
        .replace(/\\"/g, '\\"')
        .replace(/\\&/g, "\\&")
        .replace(/\\r/g, "\\r")
        .replace(/\\t/g, "\\t")
        .replace(/\\b/g, "\\b")
        .replace(/\\f/g, "\\f");
    jsonSubString = extractJson(message);
    if (jsonSubString !== null) {
        return JSON.parse(jsonSubString);
    } else {
        try {
            return JSON.parse('{"log_line": "' + message.replace(/["']/g, "") + '"}');
        } catch (ignored) {

        }
    }

    return {};
}

function extractJson(message: string): any {
    let jsonStart = message.indexOf("{");
    if (jsonStart < 0) return null;
    let jsonSubString = message.substring(jsonStart);
    return isValidJson(jsonSubString) ? jsonSubString : null;
}

function isValidJson(message: string): boolean {
    try {
        JSON.parse(message);
    } catch (e) {
        return false;
    }
    return true;
}

function isNumeric(n: any) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

export function getAppFromSenderAccount(owner: string, knownAccounts: Account[]): string | undefined {
    const app = knownAccounts.find(value => {
        if (value.accountNumber === owner) {
            return true;
        }
        return null;
    })?.app;
    if (!app) {
        throw new Error('No app for account ' + owner);
    } else {
        return app;
    }
}

export function getEnvFromSenderAccount(owner: string, knownAccounts: Account[]): string | undefined {
    const env = knownAccounts.find(value => {
        if (value.accountNumber === owner) {
            return true;
        }
        return null;
    })?.env;
    if (!env) {
        throw new Error('No env for account ' + owner);
    } else {
        return env;
    }
}

