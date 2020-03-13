import {getLatestVersion} from '../../../../lib/lambda/update-api-documentation/lambda-update-api-documentation';
import {ListOfDocumentationVersion} from "aws-sdk/clients/apigateway";

describe('update-api-documentation', () => {

    test('getLatestVersion', async () => {
        // random length array with random versions
        const docVersions: ListOfDocumentationVersion = Array.from({length: Math.ceil(Math.random() * 10)})
            .map(() => ({version: (Math.ceil(Math.random() * 10)).toString()}));

        const latest = await getLatestVersion(docVersions);
        docVersions.sort((d1, d2) => Number(d2.version) - Number(d1.version));

        expect(latest).toBe(docVersions[0].version as string);
    });

});
