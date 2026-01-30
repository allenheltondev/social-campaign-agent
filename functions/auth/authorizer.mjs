import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../utils/logger.mjs';

let verifier;
const cognito = new CognitoIdentityProviderClient();
const ddb = new DynamoDBClient();

export const handler = async (event) => {
  try {
    const authorizationToken = event.headers?.Authorization || event.headers?.authorization;

    if (!authorizationToken) {
      throw new Error('No Authorization header provided');
    }

    const tokenMatch = authorizationToken.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      logger.error('Invalid authorization token format', {
        operation: 'token-validation'
      });
      throw new Error('Unauthorized');
    }

    const token = tokenMatch[1];

    if (!verifier) {
      verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.USER_POOL_ID,
        tokenUse: 'access',
        clientId: process.env.USER_POOL_CLIENT_ID
      });
    }

    const decoded = await verifier.verify(token);
    const userInfo = await getUserAttributes(token);
    const userId = userInfo.sub || decoded.sub;
    const email = userInfo.email || '';

    if (!userId) {
      logger.error('Missing userId (sub) in user attributes', {
        operation: 'user-validation'
      });
      throw new Error('Unauthorized');
    }

    const userProfile = await getUserProfile(userId);
    const activeTeamId = userProfile?.activeTeamId;
    const tenantId = activeTeamId || userId;

    const context = {
      tenantId,
      userId,
      email
    };

    if (activeTeamId) {
      context.activeTeamId = activeTeamId;
    }

    const apiArn = getApiArnPattern(event.methodArn);
    const policy = generatePolicy(userId, 'Allow', apiArn, context);

    return policy;
  } catch (error) {
    logger.error('Authorization failed', {
      operation: 'authorization',
      errorName: error.name,
      errorMessage: error.message,
      methodArn: event.methodArn
    });

    throw new Error('Unauthorized');
  }
};

const getUserAttributes = async (accessToken) => {
  try {
    const command = new GetUserCommand({ AccessToken: accessToken });
    const response = await cognito.send(command);

    const attrs = {};
    for (const attr of response.UserAttributes) {
      attrs[attr.Name] = attr.Value;
    }

    return attrs;
  } catch (err) {
    logger.error('Error fetching user attributes', {
      operation: 'get-user-attributes',
      errorName: err.name,
      errorMessage: err.message
    });
    throw new Error('Failed to fetch user attributes');
  }
};

const getUserProfile = async (userId) => {
  try {
    const command = new GetItemCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        pk: { S: `user#${userId}` },
        sk: { S: 'profile' }
      }
    });

    const response = await ddb.send(command);

    if (!response.Item) {
      return null;
    }

    return unmarshall(response.Item);
  } catch (err) {
    logger.error('Error fetching user profile', {
      operation: 'get-user-profile',
      userId,
      errorName: err.name,
      errorMessage: err.message
    });
    return null;
  }
};

const getApiArnPattern = (methodArn) => {
  const arnParts = methodArn.split('/');
  return `${arnParts.slice(0, 2).join('/')}/*/*`;
};

const generatePolicy = (principalId, effect, resource, context = {}) => {
  const authResponse = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context
  };

  return authResponse;
};
