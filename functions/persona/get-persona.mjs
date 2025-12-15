import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;
    const { personaId } = event.pathParameters;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    if (!personaId) {
      return formatResponse(400, { message: 'Missing personaId parameter' });
    }

    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${personaId}`,
        sk: 'persona'
      })
    }));

    if (!response.Item) {
      return formatResponse(404, { message: 'Persona not found' });
    }

    const persona = unmarshall(response.Item);

    // Remove DynamoDB keys from response
    delete persona.pk;
    delete persona.sk;
    delete persona.GSI1PK;
    delete persona.GSI1SK;

    return formatResponse(200, persona);
  } catch (error) {
    console.error('Get persona error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
