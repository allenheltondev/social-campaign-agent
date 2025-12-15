#!/usr/bin/env node

import { config } from 'dotenv';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminGetUserCommand
} from '@aws-sdk/client-cognito-identity-provider';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
  profile: process.env.AWS_PROFILE
});

// Configuration from environment variables
const CONFIG = {
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
  username: process.env.COGNITO_USERNAME || process.env.ADMIN_EMAIL,
  password: process.env.COGNITO_PASSWORD,
  newPassword: process.env.COGNITO_NEW_PASSWORD,
  tempPassword: process.env.TEMP_PASSWORD || 'TempPass123!',
  tenantId: process.env.TENANT_ID || randomUUID(),
  givenName: process.env.GIVEN_NAME,
  familyName: process.env.FAMILY_NAME,
  apiUrl: process.env.API_URL
};

function validateConfig() {
  const required = ['userPoolId', 'clientId', 'username'];
  const missing = required.filter(key => !CONFIG[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => {
      const envVar = key === 'userPoolId' ? 'COGNITO_USER_POOL_ID' :
        key === 'clientId' ? 'COGNITO_CLIENT_ID' :
          key === 'username' ? 'COGNITO_USERNAME or ADMIN_EMAIL' : key;
      console.error(`   ${envVar}`);
    });
    console.error('\nPlease set these in your .env file or environment variables.');
    process.exit(1);
  }
}

async function checkUserExists() {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: CONFIG.userPoolId,
      Username: CONFIG.username
    });

    await cognito.send(command);
    console.log('✅ Admin user already exists');
    return true;
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createAdminUser() {
  console.log(`📝 Creating admin user: ${CONFIG.username}`);
  console.log(`🏢 Tenant ID: ${CONFIG.tenantId}`);

  try {
    // Build user attributes - start with required attributes
    const userAttributes = [
      { Name: 'email', Value: CONFIG.username },
      { Name: 'email_verified', Value: 'true' }
    ];

    // Add optional standard attributes if provided
    if (CONFIG.givenName) {
      userAttributes.push({ Name: 'given_name', Value: CONFIG.givenName });
    }
    if (CONFIG.familyName) {
      userAttributes.push({ Name: 'family_name', Value: CONFIG.familyName });
    }

    // Add custom tenantId attribute (defined in your User Pool schema)
    if (CONFIG.tenantId) {
      userAttributes.push({ Name: 'custom:tenantId', Value: CONFIG.tenantId });
    }

    const command = new AdminCreateUserCommand({
      UserPoolId: CONFIG.userPoolId,
      Username: CONFIG.username,
      UserAttributes: userAttributes,
      TemporaryPassword: CONFIG.tempPassword,
      MessageAction: 'SUPPRESS' // Don't send welcome email for testing
    });

    const result = await cognito.send(command);
    console.log('✅ Admin user created successfully!');
    console.log(`👤 User Status: ${result.User.UserStatus}`);
    return true;
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      console.log('✅ Admin user already exists');
      return true;
    }
    console.error('❌ Error creating user:', error.message);
    throw error;
  }
}

async function loginUser() {
  console.log('🔐 Attempting to login...');

  const command = new AdminInitiateAuthCommand({
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    UserPoolId: CONFIG.userPoolId,
    ClientId: CONFIG.clientId,
    AuthParameters: {
      USERNAME: CONFIG.username,
      PASSWORD: CONFIG.password || CONFIG.tempPassword
    }
  });

  try {
    const response = await cognito.send(command);

    let token;
    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      console.log('🔄 New password required - responding to challenge...');

      if (!CONFIG.newPassword) {
        console.error('❌ NEW_PASSWORD_REQUIRED challenge but COGNITO_NEW_PASSWORD not set');
        console.error('Please set COGNITO_NEW_PASSWORD in your .env file');
        process.exit(1);
      }

      const challengeCommand = new AdminRespondToAuthChallengeCommand({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        UserPoolId: CONFIG.userPoolId,
        ClientId: CONFIG.clientId,
        ChallengeResponses: {
          USERNAME: CONFIG.username,
          NEW_PASSWORD: CONFIG.newPassword,
          "userAttributes.given_name": CONFIG.givenName,
          "userAttributes.family_name": CONFIG.familyName
        },
        Session: response.Session
      });

      const challengeResponse = await cognito.send(challengeCommand);
      console.log('✅ Password updated successfully!');
      token = challengeResponse.AuthenticationResult.AccessToken;
    } else {
      console.log('✅ Login successful!');
      token = response.AuthenticationResult.AccessToken;
    }

    return token;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

function updateEnvFile(token) {
  let envContent = '';

  // Read existing .env file if it exists
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8');
  }

  // Remove existing ACCESS_TOKEN line if present
  const lines = envContent.split('\n').filter(line =>
    !line.startsWith('ACCESS_TOKEN=') && !line.startsWith('# ACCESS_TOKEN=')
  );

  // Add the new token
  lines.push(`ACCESS_TOKEN=${token}`);

  // Add API_URL if not present and we have it configured
  if (CONFIG.apiUrl && !lines.some(line => line.startsWith('API_URL='))) {
    lines.push(`API_URL=${CONFIG.apiUrl}`);
  }

  // Write back to file
  writeFileSync(envPath, lines.join('\n') + '\n');
  console.log('💾 Access token saved to .env file');
}

function prepareTestHarness(token) {
  const htmlPath = join(__dirname, '../test-harness.html');
  const tempHtmlPath = join(__dirname, 'test-harness-configured.html');

  console.log('🌐 Preparing test harness...');

  try {
    // Read the template HTML file
    let htmlContent = readFileSync(htmlPath, 'utf8');

    // Replace placeholders with actual values
    htmlContent = htmlContent.replace('{{API_URL}}', CONFIG.apiUrl || '');
    htmlContent = htmlContent.replace('{{ACCESS_TOKEN}}', token || '');

    // Write configured HTML to temporary file
    writeFileSync(tempHtmlPath, htmlContent);

    console.log('✅ Test harness configured successfully!');
    console.log(`📁 File created: ${tempHtmlPath}`);

    if (CONFIG.apiUrl) {
      console.log(`🔗 API URL pre-filled: ${CONFIG.apiUrl}`);
    }

    console.log('🔑 Authorization header automatically included in API requests');

  } catch (error) {
    console.error('❌ Failed to prepare test harness');
    console.error('Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting test setup...\n');

  try {
    // Validate configuration
    validateConfig();

    // Check if user exists, create if not
    const userExists = await checkUserExists();
    if (!userExists) {
      await createAdminUser();
    }

    // Login and get token
    const token = await loginUser();

    // Save token to .env file
    updateEnvFile(token);

    // Prepare test harness
    prepareTestHarness(token);

    console.log('\n✅ Test setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Open tests/manual/test-harness-configured.html in your browser');
    console.log('2. The API URL and authorization token are pre-configured');
    console.log('3. Test all available endpoints:');
    console.log('   • Episodes: Create, list, get details, update status');
    console.log('   • Uploads: Transcript and video track uploads');
    console.log('   • Clips: List, get details, update status, delete');
    console.log('   • Tracks: Update metadata (speakers)');
    console.log('\n🎯 You can now test all API endpoints through the comprehensive web interface!');

  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    process.exit(1);
  }
}

main();
