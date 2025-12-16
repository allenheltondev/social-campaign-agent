import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { QueryPersonasRequestSchema, validateQueryParams } from '../../models/persona.mjs';
import { formatResponse } from '../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const { tenantId } = event.requestContext.authorizer;

    if (!tenantId) {
      return formatResponse(401, { message: 'Unauthorized' });
    }

    const queryParams = validateQueryParams(QueryPersonasRequestSchema, event.queryStringParameters || {});

    let exclusiveStartKey;
    if (queryParams.nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString());
      } catch (e) {
        return formatResponse(400, { message: 'Invalid nextToken' });
      }
    }

    const response = await ddb.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :tenantId AND begins_with(GSI1SK, :personaPrefix)',
      FilterExpression: '#isActive = :true',
      ExpressionAttributeNames: {
        '#isActive': 'isActive'
      },
      ExpressionAttributeValues: marshall({
        ':tenantId': tenantId,
        ':personaPrefix': 'persona#',
        ':true': true
      }),
      Limit: queryParams.limit || 20,
      ExclusiveStartKey: exclusiveStartKey ? marshall(exclusiveStartKey) : undefined
    }));

    let personas = response.Items?.map(item => {
      const persona = unmarshall(item);
      // Remove DynamoDB keys from response
      delete persona.pk;
      delete persona.sk;
      delete persona.GSI1PK;
      delete persona.GSI1SK;
      return persona;
    }) || [];

    // Apply client-side filtering for search and other parameters
    if (queryParams.search) {
      const searchTerm = queryParams.search.toLowerCase();
      personas = personas.filter(persona =>
        persona.name.toLowerCase().includes(searchTerm) ||
        persona.role.toLowerCase().includes(searchTerm) ||
        persona.company.toLowerCase().includes(searchTerm) ||
        persona.primaryAudience.toLowerCase().includes(searchTerm)
      );
    }

    if (queryParams.company) {
      personas = personas.filter(persona =>
        persona.company.toLowerCase().includes(queryParams.company.toLowerCase())
      );
    }

    if (queryParams.role) {
      personas = personas.filter(persona =>
        persona.role.toLowerCase().includes(queryParams.role.toLowerCase())
      );
    }

    if (queryParams.primaryAudience) {
      personas = personas.filter(persona =>
        persona.primaryAudience === queryParams.primaryAudience
      );
    }

    const result = { personas };

    if (response.LastEvaluatedKey) {
      result.nextToken = Buffer.from(JSON.stringify(unmarshall(response.LastEvaluatedKey))).toString('base64');
    }

    return formatResponse(200, result);
  } catch (error) {
    console.error('List personas error:', error);

    if (error.message.includes('validation error')) {
      return formatResponse(400, { message: error.message });
    }

    return formatResponse(500, { message: 'Internal server error' });
  }
};
