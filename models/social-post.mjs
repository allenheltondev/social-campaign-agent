import { DynamoDBClient, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { SocialPostSchema } from './campaign.mjs';

const ddb = new DynamoDBClient();

export class SocialPost {
  static async findById(tenantId, campaignId, postId) {
    const response = await ddb.send(new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: `POST#${postId}`
      })
    }));

    if (!response.Item) {
      return null;
    }

    const rawPost = unmarshall(response.Item);
    return this.transformFromDynamoDB(rawPost);
  }

  static async findByCampaign(tenantId, campaignId, limit = 50, nextToken = null) {
    const queryParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': `${tenantId}#${campaignId}`,
        ':sk': 'POST#'
      }),
      Limit: limit,
      ScanIndexForward: true
    };

    if (nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const response = await ddb.send(new QueryCommand(queryParams));

    const posts = response.Items?.map(item => {
      const rawPost = unmarshall(item);
      return this.transformFromDynamoDB(rawPost);
    }) || [];

    const responseNextToken = response.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      posts,
      nextToken: responseNextToken
    };
  }

  static async findByPersona(tenantId, personaId, limit = 50, nextToken = null) {
    const queryParams = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': `${tenantId}#${personaId}`,
        ':sk': 'POST#'
      }),
      Limit: limit,
      ScanIndexForward: true
    };

    if (nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const response = await ddb.send(new QueryCommand(queryParams));

    const posts = response.Items?.map(item => {
      const rawPost = unmarshall(item);
      return this.transformFromDynamoDB(rawPost);
    }) || [];

    const responseNextToken = response.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64')
      : null;

    return {
      posts,
      nextToken: responseNextToken
    };
  }

  static transformFromDynamoDB(rawPost) {
    const cleanPost = { ...rawPost };

    delete cleanPost.pk;
    delete cleanPost.sk;
    delete cleanPost.GSI1PK;
    delete cleanPost.GSI1SK;
    delete cleanPost.GSI2PK;
    delete cleanPost.GSI2SK;

    return SocialPostSchema.parse(cleanPost);
  }

  static transformToDynamoDB(tenantId, campaignId, post) {
    return {
      pk: `${tenantId}#${campaignId}`,
      sk: `POST#${post.postId}`,
      GSI1PK: `${tenantId}#${campaignId}`,
      GSI1SK: `POST#${post.platform}#${post.scheduledAt}`,
      GSI2PK: `${tenantId}#${post.personaId}`,
      GSI2SK: `POST#${campaignId}#${post.scheduledAt}`,
      ...post
    };
  }

  static async updateStatus(tenantId, campaignId, postId, status, error = null) {
    const now = new Date().toISOString();
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt, version = version + :inc';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues = {
      ':status': status,
      ':updatedAt': now,
      ':inc': 1
    };

    if (error) {
      updateExpression += ', lastError = :error';
      expressionAttributeValues[':error'] = error;
    }

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: `POST#${postId}`
      }),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: marshall(expressionAttributeValues)
    }));

    return {
      success: true,
      postId,
      status
    };
  }

  static async updateContent(tenantId, campaignId, postId, content) {
    const now = new Date().toISOString();

    await ddb.send(new UpdateItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: marshall({
        pk: `${tenantId}#${campaignId}`,
        sk: `POST#${postId}`
      }),
      UpdateExpression: 'SET content = :content, updatedAt = :updatedAt, version = version + :inc',
      ExpressionAttributeValues: marshall({
        ':content': {
          ...content,
          generatedAt: now
        },
        ':updatedAt': now,
        ':inc': 1
      })
    }));

    return {
      success: true,
      postId,
      content
    };
  }
}
