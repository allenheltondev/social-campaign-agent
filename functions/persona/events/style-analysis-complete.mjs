import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../../utils/logger.mjs';

const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const {detail} = event;

    if (!detail) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing required fields in event detail' })
      };
    }

    const { tenantId, personaId, requestId, styleData, success } = detail;

    if (!tenantId || !personaId || !requestId) {
      logger.error('Missing required fields in event detail', {
        operation: 'style-analysis-complete',
        detail,
        errorName: 'ValidationError',
        errorMessage: 'Missing required fields in event detail'
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: 'Missing required fields in event detail' })
      };
    }

    if (success) {
      if (!styleData || !styleData.sentenceLengthPattern || !styleData.structurePreference) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Invalid style data structure' })
        };
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

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: `Style analysis completed successfully for persona ${personaId}`,
          requestId
        })
      };
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

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(response)
      };
    }

  } catch (error) {
    logger.error('Style analysis complete failed', {
      operation: 'style-analysis-complete',
      personaId: event.detail?.personaId,
      tenantId: event.detail?.tenantId,
      errorName: error.name,
      errorMessage: error.message
    });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
