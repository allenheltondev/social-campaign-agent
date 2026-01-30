#!/usr/bin/env node

import { config } from 'dotenv';
import { spawn } from 'child_process';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';

config();

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
  profile: process.env.AWS_PROFILE
});

const CONFIG = {
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  username: process.env.COGNITO_USERNAME,
  password: process.env.COGNITO_NEW_PASSWORD || process.env.COGNITO_PASSWORD,
  newPassword: process.env.COGNITO_NEW_PASSWORD
};

async function getToken() {
  console.log('🔐 Getting access token...\n');

  const command = new AdminInitiateAuthCommand({
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    UserPoolId: CONFIG.userPoolId,
    ClientId: CONFIG.clientId,
    AuthParameters: {
      USERNAME: CONFIG.username,
      PASSWORD: CONFIG.password
    }
  });

  try {
    const response = await cognito.send(command);

    let token;
    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      console.log('🔄 New password required...');

      const challengeCommand = new AdminRespondToAuthChallengeCommand({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        UserPoolId: CONFIG.userPoolId,
        ClientId: CONFIG.clientId,
        ChallengeResponses: {
          USERNAME: CONFIG.username,
          NEW_PASSWORD: CONFIG.newPassword
        },
        Session: response.Session
      });

      const challengeResponse = await cognito.send(challengeCommand);
      token = challengeResponse.AuthenticationResult.AccessToken;
    } else {
      token = response.AuthenticationResult.AccessToken;
    }

    return token;
  } catch (error) {
    console.error('❌ Failed to get token:', error.message);
    process.exit(1);
  }
}

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn('clip', [], { shell: true });

    proc.stdin.write(text);
    proc.stdin.end();

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`clip exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  try {
    const token = await getToken();

    await copyToClipboard(token);

    console.log('✅ Access token copied to clipboard!\n');
    console.log('📋 Token preview:', `${token.substring(0, 50)}...\n`);
    console.log('💡 Paste into Postman collection variable or Authorization header');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
