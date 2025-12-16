import { withDurableExecution } from '@aws/durable-execution-sdk-js';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient();
export const handler = withDurableExecution(
  async (event, context) => {
    const { tenantId, campaign } = event;

    const isNew = await context.step('Save campaign', async () => {
      try {
        await ddb.send(new PutItemCommand({
          TableName: process.env.TABLE_NAME,
          Item: marshall({
            pk: `${tenantId}#${campaign.id}`,
            sk: 'campaign',
            GSI1PK: tenantId,
            GSI1SK: `campaign#${now}`,
            ...campaign
          }),
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
        }));
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          return false;
        }
        throw err;
      }
      return true;
    });

    if(!isNew){
      return;
    }
  }
);
