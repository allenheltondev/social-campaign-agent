import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { formatResponse } from '../../../utils/api-response.mjs';

const ddb = new DynamoDBClient();

/**
 * Handle style analysis completion notifications from EventBridge
 * @param {Object} event - EventBridge event
 * @returns {Object} Processing result
 */
export const handler = async (event) => {
  try {
    const detail = event.detail;

    if (!detail) {
      return formatResponse(400, { message: 'Missing required fields in event detail' });
    }

    const { tenantId, personaId, requestId, styleData, success } = detail;

    if (!tenantId || !personaId || !requestId) {
      console.error('Missing required fields in event detail:', detail);
      return formatResponse(400, { message: 'Missing required fields in event detail' });
    }

    if (success) {
      if (!styleData || !styleData.sentenceLengthPattern || !styleData.structurePreference) {
        return formatResponse(400, { message: 'Invalid style data structure' });
      }

      const updateParams = {
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${personaId}`,
          sk: 'persona'
        }),
        UpdateExpression: 'SET styleData = :styleData, analysisStatus = :status, lastAnalysisAt = :timestamp',
        ExpressionAttributeNames: {
        },
        ExpressionAttributeValues: marshall({
          ':styleData': styleData,
          ':status': 'completed',
          ':timestamp': new Date().toISOString()
        })
      };

      await ddb.send(new UpdateItemCommand(updateParams));

      return formatResponse(200, {
        message: `Style analysis completed successfully for persona ${personaId}`,
        requestId
      });
    } else {
      const updateParams = {
        TableName: process.env.TABLE_NAME,
        Key: marshall({
          pk: `${tenantId}#${personaId}`,
          sk: 'persona'
        }),
        UpdateExpression: 'SET analysisStatus = :status, lastAnalysisAt = :timestamp',
        ExpressionAttributeValues: marshall({
          ':status': 'failed',
          ':timestamp': new Date().toISOString()
        })
      };

      await ddb.send(new UpdateItemCommand(updateParams));

      const response = {
        message: `Style analysis failed for persona ${personaId}`,
        requestId
      };

      if (detail.error) {
        response.error = detail.error;
      }

      return formatResponse(200, response);
    }

  } catch (error) {
    console.error('Style analysis complete error:', error);
    return formatResponse(500, { message: 'Internal server error' });
  }
};
