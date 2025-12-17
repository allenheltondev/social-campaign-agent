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
      PASSWORD: CONFIG.newPassword || CONFIG.password || CONFIG.tempPassword
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
  const tempHtmlPath = join(__dirname, 'test-harness-configured.html');

  console.log('🌐 Preparing test harness...');

  try {
    const htmlContent = generateTestHarnessHTML(token);
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

function generateTestHarnessHTML(token) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Campaign Builder Test Harness</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 8px; }
        h2 { color: #555; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
        h3 { color: #666; margin-top: 24px; margin-bottom: 12px; }
        .form-group {
            margin-bottom: 16px;
        }
        label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: #333;
        }
        input, select, textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        .checkbox-group {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 8px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .checkbox-item input[type="checkbox"] {
            width: auto;
            margin: 0;
        }
        .range-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .range-group input[type="range"] {
            flex: 1;
        }
        .range-value {
            min-width: 30px;
            text-align: center;
            font-weight: 500;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
        }
        button:hover {
            background: #0056b3;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .response {
            margin-top: 16px;
            padding: 12px;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
        }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .config {
            background: #e2e3e5;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 24px;
            font-family: monospace;
            font-size: 12px;
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid #ddd;
            margin-bottom: 24px;
        }
        .tab {
            padding: 12px 24px;
            cursor: pointer;
            border: none;
            background: none;
            border-bottom: 2px solid transparent;
            color: #666;
        }
        .tab.active {
            border-bottom-color: #007bff;
            color: #007bff;
            font-weight: 500;
        }
        .tab:hover {
            color: #007bff;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .array-input {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .array-input input {
            flex: 1;
        }
        .array-input button {
            padding: 8px 12px;
            background: #dc3545;
        }
        .add-button {
            background: #28a745;
            padding: 8px 16px;
            margin-top: 8px;
        }
        .campaign-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .campaign-item:hover {
            background-color: #f8f9fa;
        }
        .campaign-item.selected {
            background-color: #e3f2fd;
            border-left: 4px solid #007bff;
        }
        .campaign-item:last-child {
            border-bottom: none;
        }
        .campaign-name {
            font-weight: 500;
            color: #333;
            margin-bottom: 4px;
        }
        .campaign-meta {
            font-size: 12px;
            color: #666;
        }
        .post-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
            margin-bottom: 8px;
            border-radius: 4px;
        }
        .post-item:last-child {
            margin-bottom: 0;
        }
        .post-platform {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-right: 8px;
        }
        .post-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
        }
        .post-status.draft { background: #ffc107; color: #000; }
        .post-status.scheduled { background: #17a2b8; color: white; }
        .post-status.published { background: #28a745; color: white; }
        .post-status.failed { background: #dc3545; color: white; }
        .post-content {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Campaign Builder Test Harness</h1>
        <div class="config">
            <strong>API URL:</strong> ${CONFIG.apiUrl || 'Not configured'}<br>
            <strong>Token:</strong> ${token ? 'Configured' : 'Not configured'}<br>
            <strong>Tenant ID:</strong> ${CONFIG.tenantId}
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('persona')">Create Persona</button>
            <button class="tab" onclick="showTab('brand')">Create Brand</button>
            <button class="tab" onclick="showTab('campaign')">Create Campaign</button>
            <button class="tab" onclick="showTab('campaigns')">View Campaigns</button>
            <button class="tab" onclick="showTab('json')">JSON Mode</button>
        </div>

        <!-- Persona Tab -->
        <div id="persona-tab" class="tab-content active">
            <h2>Create Persona</h2>
            <form id="persona-form">
                <div class="form-group">
                    <label for="persona-name">Name *</label>
                    <input type="text" id="persona-name" name="name" required>
                </div>

                <div class="form-group">
                    <label for="persona-role">Role *</label>
                    <input type="text" id="persona-role" name="role" required>
                </div>

                <div class="form-group">
                    <label for="persona-company">Company *</label>
                    <input type="text" id="persona-company" name="company" required>
                </div>

                <div class="form-group">
                    <label for="persona-audience">Primary Audience *</label>
                    <select id="persona-audience" name="primaryAudience" required>
                        <option value="">Select audience...</option>
                        <option value="executives">Executives</option>
                        <option value="professionals">Professionals</option>
                        <option value="consumers">Consumers</option>
                        <option value="technical">Technical</option>
                        <option value="creative">Creative</option>
                    </select>
                </div>

                <h3>Voice Traits</h3>
                <div class="form-group">
                    <label>Select voice traits (at least 1) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-direct" name="voiceTraits" value="direct" checked>
                            <label for="trait-direct">Direct</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-warm" name="voiceTraits" value="warm">
                            <label for="trait-warm">Warm</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-candid" name="voiceTraits" value="candid">
                            <label for="trait-candid">Candid</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-technical" name="voiceTraits" value="technical">
                            <label for="trait-technical">Technical</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-playful" name="voiceTraits" value="playful">
                            <label for="trait-playful">Playful</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-skeptical" name="voiceTraits" value="skeptical">
                            <label for="trait-skeptical">Skeptical</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-optimistic" name="voiceTraits" value="optimistic">
                            <label for="trait-optimistic">Optimistic</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-pragmatic" name="voiceTraits" value="pragmatic">
                            <label for="trait-pragmatic">Pragmatic</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-analytical" name="voiceTraits" value="analytical">
                            <label for="trait-analytical">Analytical</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="trait-empathetic" name="voiceTraits" value="empathetic">
                            <label for="trait-empathetic">Empathetic</label>
                        </div>
                    </div>
                </div>

                <h3>Writing Habits</h3>
                <div class="form-group">
                    <label for="paragraphs">Paragraph Length</label>
                    <select id="paragraphs" name="paragraphs" required>
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="questions">Question Usage</label>
                    <select id="questions" name="questions" required>
                        <option value="frequent">Frequent</option>
                        <option value="occasional">Occasional</option>
                        <option value="rare">Rare</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="emojis">Emoji Usage</label>
                    <select id="emojis" name="emojis" required>
                        <option value="frequent">Frequent</option>
                        <option value="sparing">Sparing</option>
                        <option value="none">None</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="structure">Content Structure</label>
                    <select id="structure" name="structure" required>
                        <option value="prose">Prose</option>
                        <option value="lists">Lists</option>
                        <option value="mixed">Mixed</option>
                    </select>
                </div>

                <h3>Opinions & Beliefs</h3>
                <div class="form-group">
                    <label>Strong Beliefs (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-quality" name="strongBeliefs" value="Quality over quantity" checked>
                            <label for="belief-quality">Quality over quantity</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-transparency" name="strongBeliefs" value="Transparency builds trust">
                            <label for="belief-transparency">Transparency builds trust</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-innovation" name="strongBeliefs" value="Innovation drives progress">
                            <label for="belief-innovation">Innovation drives progress</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-customer" name="strongBeliefs" value="Customer success is our success">
                            <label for="belief-customer">Customer success is our success</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-simplicity" name="strongBeliefs" value="Simplicity is sophistication">
                            <label for="belief-simplicity">Simplicity is sophistication</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="belief-data" name="strongBeliefs" value="Data-driven decisions">
                            <label for="belief-data">Data-driven decisions</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Topics to Avoid (select any that apply)</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-politics" name="avoidTopics" value="Politics">
                            <label for="avoid-politics">Politics</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-religion" name="avoidTopics" value="Religion">
                            <label for="avoid-religion">Religion</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-controversial" name="avoidTopics" value="Controversial social issues">
                            <label for="avoid-controversial">Controversial social issues</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-competitors" name="avoidTopics" value="Direct competitor criticism">
                            <label for="avoid-competitors">Direct competitor criticism</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-personal" name="avoidTopics" value="Personal financial advice">
                            <label for="avoid-personal">Personal financial advice</label>
                        </div>
                    </div>
                </div>

                <h3>Language Preferences</h3>
                <div class="form-group">
                    <label>Words/Phrases to Avoid (select any that apply)</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-jargon" name="languageAvoid" value="Technical jargon">
                            <label for="avoid-jargon">Technical jargon</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-buzzwords" name="languageAvoid" value="Corporate buzzwords">
                            <label for="avoid-buzzwords">Corporate buzzwords</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-superlatives" name="languageAvoid" value="Excessive superlatives">
                            <label for="avoid-superlatives">Excessive superlatives</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-slang" name="languageAvoid" value="Slang or informal language">
                            <label for="avoid-slang">Slang or informal language</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="avoid-passive" name="languageAvoid" value="Passive voice">
                            <label for="avoid-passive">Passive voice</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Preferred Language Style (select any that apply)</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="prefer-clear" name="languagePrefer" value="Clear and concise" checked>
                            <label for="prefer-clear">Clear and concise</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="prefer-actionable" name="languagePrefer" value="Actionable language">
                            <label for="prefer-actionable">Actionable language</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="prefer-inclusive" name="languagePrefer" value="Inclusive language">
                            <label for="prefer-inclusive">Inclusive language</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="prefer-data" name="languagePrefer" value="Data-backed statements">
                            <label for="prefer-data">Data-backed statements</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="prefer-conversational" name="languagePrefer" value="Conversational tone">
                            <label for="prefer-conversational">Conversational tone</label>
                        </div>
                    </div>
                </div>

                <h3>Call-to-Action Style</h3>
                <div class="form-group">
                    <label for="cta-aggressiveness">CTA Aggressiveness</label>
                    <select id="cta-aggressiveness" name="ctaAggressiveness" required>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>CTA Patterns (select any that apply)</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-learn" name="ctaPatterns" value="Learn more" checked>
                            <label for="cta-learn">Learn more</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-get" name="ctaPatterns" value="Get started">
                            <label for="cta-get">Get started</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-discover" name="ctaPatterns" value="Discover how">
                            <label for="cta-discover">Discover how</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-explore" name="ctaPatterns" value="Explore solutions">
                            <label for="cta-explore">Explore solutions</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-join" name="ctaPatterns" value="Join the conversation">
                            <label for="cta-join">Join the conversation</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="cta-share" name="ctaPatterns" value="Share your thoughts">
                            <label for="cta-share">Share your thoughts</label>
                        </div>
                    </div>
                </div>

                <button type="submit">Create Persona</button>
            </form>
            <div id="persona-response"></div>
        </div>

        <!-- Brand Tab -->
        <div id="brand-tab" class="tab-content">
            <h2>Create Brand</h2>
            <form id="brand-form">
                <div class="form-group">
                    <label for="brand-name">Brand Name *</label>
                    <input type="text" id="brand-name" name="name" required>
                </div>

                <div class="form-group">
                    <label for="brand-ethos">Brand Ethos *</label>
                    <textarea id="brand-ethos" name="ethos" placeholder="Describe your brand's core philosophy and mission..." required></textarea>
                </div>

                <div class="form-group">
                    <label>Core Values (at least 1) *</label>
                    <div id="core-values">
                        <div class="array-input">
                            <input type="text" placeholder="Enter a core value...">
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addArrayItem('core-values', 'Enter a core value...')">Add Value</button>
                </div>

                <h3>Personality Traits (1-5 scale)</h3>
                <div class="form-group">
                    <label for="formal-range">Formal</label>
                    <div class="range-group">
                        <span>1</span>
                        <input type="range" id="formal-range" name="formal" min="1" max="5" value="3" oninput="updateRangeValue('formal-range', 'formal-value')">
                        <span>5</span>
                        <span class="range-value" id="formal-value">3</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="innovative-range">Innovative</label>
                    <div class="range-group">
                        <span>1</span>
                        <input type="range" id="innovative-range" name="innovative" min="1" max="5" value="3" oninput="updateRangeValue('innovative-range', 'innovative-value')">
                        <span>5</span>
                        <span class="range-value" id="innovative-value">3</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="trustworthy-range">Trustworthy</label>
                    <div class="range-group">
                        <span>1</span>
                        <input type="range" id="trustworthy-range" name="trustworthy" min="1" max="5" value="3" oninput="updateRangeValue('trustworthy-range', 'trustworthy-value')">
                        <span>5</span>
                        <span class="range-value" id="trustworthy-value">3</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="playful-range">Playful</label>
                    <div class="range-group">
                        <span>1</span>
                        <input type="range" id="playful-range" name="playful" min="1" max="5" value="3" oninput="updateRangeValue('playful-range', 'playful-value')">
                        <span>5</span>
                        <span class="range-value" id="playful-value">3</span>
                    </div>
                </div>

                <h3>Platform Guidelines</h3>
                <div class="form-group">
                    <label>Enabled Platforms (at least 1) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-twitter" name="enabledPlatforms" value="twitter" checked>
                            <label for="platform-twitter">Twitter</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-linkedin" name="enabledPlatforms" value="linkedin" checked>
                            <label for="platform-linkedin">LinkedIn</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-instagram" name="enabledPlatforms" value="instagram" checked>
                            <label for="platform-instagram">Instagram</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-facebook" name="enabledPlatforms" value="facebook" checked>
                            <label for="platform-facebook">Facebook</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="brand-audience">Primary Audience *</label>
                    <select id="brand-audience" name="primaryAudience" required>
                        <option value="">Select audience...</option>
                        <option value="executives">Executives</option>
                        <option value="professionals">Professionals</option>
                        <option value="consumers">Consumers</option>
                        <option value="technical">Technical</option>
                        <option value="creative">Creative</option>
                    </select>
                </div>

                <h3>Voice Guidelines *</h3>
                <div class="form-group">
                    <label>Tone (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-professional" name="voiceTone" value="professional" checked>
                            <label for="tone-professional">Professional</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-warm" name="voiceTone" value="warm">
                            <label for="tone-warm">Warm</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-casual" name="voiceTone" value="casual">
                            <label for="tone-casual">Casual</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-authoritative" name="voiceTone" value="authoritative">
                            <label for="tone-authoritative">Authoritative</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-friendly" name="voiceTone" value="friendly">
                            <label for="tone-friendly">Friendly</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-innovative" name="voiceTone" value="innovative">
                            <label for="tone-innovative">Innovative</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="tone-trustworthy" name="voiceTone" value="trustworthy">
                            <label for="tone-trustworthy">Trustworthy</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Style (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-clear" name="voiceStyle" value="clear" checked>
                            <label for="style-clear">Clear</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-concise" name="voiceStyle" value="concise">
                            <label for="style-concise">Concise</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-data-driven" name="voiceStyle" value="data-driven">
                            <label for="style-data-driven">Data-driven</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-solution-focused" name="voiceStyle" value="solution-focused">
                            <label for="style-solution-focused">Solution-focused</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-engaging" name="voiceStyle" value="engaging">
                            <label for="style-engaging">Engaging</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="style-educational" name="voiceStyle" value="educational">
                            <label for="style-educational">Educational</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Messaging (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-innovation" name="voiceMessaging" value="innovation" checked>
                            <label for="messaging-innovation">Innovation</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-reliability" name="voiceMessaging" value="reliability">
                            <label for="messaging-reliability">Reliability</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-customer-success" name="voiceMessaging" value="customer success">
                            <label for="messaging-customer-success">Customer success</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-technology-leadership" name="voiceMessaging" value="technology leadership">
                            <label for="messaging-technology-leadership">Technology leadership</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-scalability" name="voiceMessaging" value="scalability">
                            <label for="messaging-scalability">Scalability</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="messaging-security" name="voiceMessaging" value="security">
                            <label for="messaging-security">Security</label>
                        </div>
                    </div>
                </div>

                <h3>Visual Identity *</h3>
                <div class="form-group">
                    <label>Color Palette (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-blue" name="colorPalette" value="#007bff" checked>
                            <label for="color-blue">Blue (#007bff)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-green" name="colorPalette" value="#28a745">
                            <label for="color-green">Green (#28a745)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-purple" name="colorPalette" value="#6f42c1">
                            <label for="color-purple">Purple (#6f42c1)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-orange" name="colorPalette" value="#fd7e14">
                            <label for="color-orange">Orange (#fd7e14)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-red" name="colorPalette" value="#dc3545">
                            <label for="color-red">Red (#dc3545)</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="color-dark" name="colorPalette" value="#343a40">
                            <label for="color-dark">Dark Gray (#343a40)</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Typography (select 1-2) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="font-inter" name="typography" value="Inter" checked>
                            <label for="font-inter">Inter</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="font-roboto" name="typography" value="Roboto">
                            <label for="font-roboto">Roboto</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="font-opensans" name="typography" value="Open Sans">
                            <label for="font-opensans">Open Sans</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="font-lato" name="typography" value="Lato">
                            <label for="font-lato">Lato</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="font-montserrat" name="typography" value="Montserrat">
                            <label for="font-montserrat">Montserrat</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Imagery Style (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-modern" name="imagery" value="modern" checked>
                            <label for="imagery-modern">Modern</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-clean" name="imagery" value="clean">
                            <label for="imagery-clean">Clean</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-professional" name="imagery" value="professional">
                            <label for="imagery-professional">Professional</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-diverse" name="imagery" value="diverse">
                            <label for="imagery-diverse">Diverse</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-minimalist" name="imagery" value="minimalist">
                            <label for="imagery-minimalist">Minimalist</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="imagery-vibrant" name="imagery" value="vibrant">
                            <label for="imagery-vibrant">Vibrant</label>
                        </div>
                    </div>
                </div>

                <h3>Content Standards *</h3>
                <div class="form-group">
                    <label>Quality Requirements (select 1-3) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-factchecked" name="qualityRequirements" value="fact-checked" checked>
                            <label for="quality-factchecked">Fact-checked</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-original" name="qualityRequirements" value="original">
                            <label for="quality-original">Original</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-engaging" name="qualityRequirements" value="engaging">
                            <label for="quality-engaging">Engaging</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-actionable" name="qualityRequirements" value="actionable">
                            <label for="quality-actionable">Actionable</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-accessible" name="qualityRequirements" value="accessible">
                            <label for="quality-accessible">Accessible</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="quality-timely" name="qualityRequirements" value="timely">
                            <label for="quality-timely">Timely</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Content Restrictions (select any that apply)</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="restrict-controversial" name="contentRestrictions" value="no controversial topics">
                            <label for="restrict-controversial">No controversial topics</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="restrict-jargon" name="contentRestrictions" value="avoid jargon">
                            <label for="restrict-jargon">Avoid jargon</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="restrict-sources" name="contentRestrictions" value="include data sources">
                            <label for="restrict-sources">Include data sources</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="restrict-competitors" name="contentRestrictions" value="no direct competitor mentions">
                            <label for="restrict-competitors">No direct competitor mentions</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="restrict-claims" name="contentRestrictions" value="no unsubstantiated claims">
                            <label for="restrict-claims">No unsubstantiated claims</label>
                        </div>
                    </div>
                </div>

                <h3>Claims Policy</h3>
                <div class="form-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="no-guarantees" name="noGuarantees" checked>
                        <label for="no-guarantees">No Guarantees</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="no-performance-numbers" name="noPerformanceNumbers" checked>
                        <label for="no-performance-numbers">No Performance Numbers Unless Provided</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="require-source" name="requireSource" checked>
                        <label for="require-source">Require Source for Stats</label>
                    </div>
                </div>

                <div class="form-group">
                    <label for="competitor-policy">Competitor Mention Policy</label>
                    <select id="competitor-policy" name="competitorPolicy" required>
                        <option value="avoid">Avoid</option>
                        <option value="neutral_only">Neutral Only</option>
                        <option value="allowed">Allowed</option>
                    </select>
                </div>

                <h3>Approval Policy</h3>
                <div class="form-group">
                    <label for="approval-threshold">Approval Threshold</label>
                    <div class="range-group">
                        <span>0</span>
                        <input type="range" id="approval-threshold" name="approvalThreshold" min="0" max="0.1" value="0.7" oninput="updateRangeValue('approval-threshold', 'threshold-value')">
                        <span>1</span>
                        <span class="range-value" id="threshold-value">0.7</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="approval-mode">Approval Mode</label>
                    <select id="approval-mode" name="approvalMode" required>
                        <option value="auto_approve">Auto Approve</option>
                        <option value="require_review_below_threshold">Require Review Below Threshold</option>
                        <option value="always_review">Always Review</option>
                    </select>
                </div>

                <button type="submit">Create Brand</button>
            </form>
            <div id="brand-response"></div>
        </div>

        <!-- Campaign Tab -->
        <div id="campaign-tab" class="tab-content">
            <h2>Create Campaign</h2>
            <button type="button" onclick="refreshCampaignData()" style="margin-bottom: 16px; background: #28a745;">Refresh Brands & Personas</button>
            <form id="campaign-form">
                <div class="form-group">
                    <label for="campaign-name">Campaign Name *</label>
                    <input type="text" id="campaign-name" name="name" required>
                </div>

                <div class="form-group">
                    <label for="campaign-brand">Brand (optional)</label>
                    <select id="campaign-brand" name="brandId">
                        <option value="">Select a brand...</option>
                    </select>
                </div>

                <h3>Campaign Brief *</h3>
                <div class="form-group">
                    <label for="campaign-description">Description *</label>
                    <textarea id="campaign-description" name="description" placeholder="Describe your campaign goals and messaging..." required></textarea>
                </div>

                <div class="form-group">
                    <label for="campaign-objective">Objective *</label>
                    <select id="campaign-objective" name="objective" required>
                        <option value="">Select objective...</option>
                        <option value="awareness">Awareness</option>
                        <option value="education">Education</option>
                        <option value="conversion">Conversion</option>
                        <option value="event">Event</option>
                        <option value="launch">Launch</option>
                    </select>
                </div>

                <h3>Call-to-Action (required for conversion/event objectives)</h3>
                <div class="form-group">
                    <label for="cta-type">CTA Type</label>
                    <input type="text" id="cta-type" name="ctaType" placeholder="e.g., Learn More, Sign Up, Register">
                </div>

                <div class="form-group">
                    <label for="cta-text">CTA Text</label>
                    <input type="text" id="cta-text" name="ctaText" placeholder="e.g., Get started today">
                </div>

                <div class="form-group">
                    <label for="cta-url">CTA URL</label>
                    <input type="url" id="cta-url" name="ctaUrl" placeholder="https://example.com">
                </div>

                <h3>Participants *</h3>
                <div class="form-group">
                    <label>Personas (at least 1) *</label>
                    <div id="persona-ids">
                        <div class="array-input">
                            <select style="width: 85%;">
                                <option value="">Select a persona...</option>
                            </select>
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addPersonaSelector()">Add Persona</button>
                </div>

                <div class="form-group">
                    <label>Platforms (at least 1) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-twitter" name="platforms" value="twitter" checked>
                            <label for="platform-twitter">Twitter</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-linkedin" name="platforms" value="linkedin" checked>
                            <label for="platform-linkedin">LinkedIn</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-instagram" name="platforms" value="instagram">
                            <label for="platform-instagram">Instagram</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="platform-facebook" name="platforms" value="facebook">
                            <label for="platform-facebook">Facebook</label>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="distribution-mode">Distribution Mode</label>
                    <select id="distribution-mode" name="distributionMode">
                        <option value="balanced">Balanced</option>
                        <option value="weighted">Weighted</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <h3>Schedule *</h3>
                <div class="form-group">
                    <label for="timezone">Timezone *</label>
                    <select id="timezone" name="timezone" required>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="UTC">UTC</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="start-date">Start Date *</label>
                    <input type="datetime-local" id="start-date" name="startDate" required>
                </div>

                <div class="form-group">
                    <label for="end-date">End Date *</label>
                    <input type="datetime-local" id="end-date" name="endDate" required>
                </div>

                <div class="form-group">
                    <label>Allowed Days of Week (at least 1) *</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-mon" name="allowedDays" value="mon" checked>
                            <label for="day-mon">Monday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-tue" name="allowedDays" value="tue" checked>
                            <label for="day-tue">Tuesday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-wed" name="allowedDays" value="wed" checked>
                            <label for="day-wed">Wednesday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-thu" name="allowedDays" value="thu" checked>
                            <label for="day-thu">Thursday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-fri" name="allowedDays" value="fri" checked>
                            <label for="day-fri">Friday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-sat" name="allowedDays" value="sat">
                            <label for="day-sat">Saturday</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="day-sun" name="allowedDays" value="sun">
                            <label for="day-sun">Sunday</label>
                        </div>
                    </div>
                </div>

                <h3>Posting Windows (optional)</h3>
                <div class="form-group">
                    <label>Posting Windows</label>
                    <div id="posting-windows">
                        <div class="array-input">
                            <input type="time" placeholder="Start time" style="width: 45%;">
                            <input type="time" placeholder="End time" style="width: 45%;">
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addPostingWindow()">Add Posting Window</button>
                </div>

                <h3>Cadence Overrides (optional)</h3>
                <div class="form-group">
                    <label for="min-posts-week">Minimum Posts Per Week</label>
                    <input type="number" id="min-posts-week" name="minPostsPerWeek" min="1" max="50">
                </div>

                <div class="form-group">
                    <label for="max-posts-week">Maximum Posts Per Week</label>
                    <input type="number" id="max-posts-week" name="maxPostsPerWeek" min="1" max="50">
                </div>

                <div class="form-group">
                    <label for="max-posts-day">Maximum Posts Per Day</label>
                    <input type="number" id="max-posts-day" name="maxPostsPerDay" min="1" max="10">
                </div>

                <h3>Messaging Pillars (optional)</h3>
                <div class="form-group">
                    <label>Messaging Pillars (weights must sum to 1.0)</label>
                    <div id="messaging-pillars">
                        <div class="array-input">
                            <input type="text" placeholder="Pillar name" style="width: 60%;">
                            <input type="number" placeholder="Weight (0-1)" min="0" max="1" step="0.1" style="width: 30%;">
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addMessagingPillar()">Add Messaging Pillar</button>
                </div>

                <div class="form-group">
                    <label>Required Inclusions</label>
                    <div id="required-inclusions">
                        <div class="array-input">
                            <input type="text" placeholder="Required content to include...">
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addArrayItem('required-inclusions', 'Required content to include...')">Add Inclusion</button>
                </div>

                <div class="form-group">
                    <label>Campaign Avoid Topics</label>
                    <div id="campaign-avoid-topics">
                        <div class="array-input">
                            <input type="text" placeholder="Topic to avoid...">
                            <button type="button" onclick="removeArrayItem(this)">Remove</button>
                        </div>
                    </div>
                    <button type="button" class="add-button" onclick="addArrayItem('campaign-avoid-topics', 'Topic to avoid...')">Add Avoid Topic</button>
                </div>

                <h3>Asset Overrides (optional)</h3>
                <div class="form-group">
                    <label>Force Visuals</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="force-twitter-visuals" name="forceVisuals" value="twitter">
                            <label for="force-twitter-visuals">Force Twitter Visuals</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="force-linkedin-visuals" name="forceVisuals" value="linkedin">
                            <label for="force-linkedin-visuals">Force LinkedIn Visuals</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="force-instagram-visuals" name="forceVisuals" value="instagram">
                            <label for="force-instagram-visuals">Force Instagram Visuals</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="force-facebook-visuals" name="forceVisuals" value="facebook">
                            <label for="force-facebook-visuals">Force Facebook Visuals</label>
                        </div>
                    </div>
                </div>

                <h3>Metadata</h3>
                <div class="form-group">
                    <label for="campaign-source">Source</label>
                    <select id="campaign-source" name="source">
                        <option value="api">API</option>
                        <option value="wizard">Wizard</option>
                        <option value="import">Import</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="external-ref">External Reference</label>
                    <input type="text" id="external-ref" name="externalRef" placeholder="External system reference">
                </div>

                <button type="submit">Create Campaign</button>
            </form>
            <div id="campaign-response"></div>
        </div>

        <!-- View Campaigns Tab -->
        <div id="campaigns-tab" class="tab-content">
            <h2>View Campaigns</h2>
            <button type="button" onclick="loadCampaignsList()" style="margin-bottom: 16px; background: #28a745;">Refresh Campaigns</button>

            <div style="display: flex; gap: 24px;">
                <!-- Campaigns List -->
                <div style="flex: 1;">
                    <h3>Campaigns (newest first)</h3>
                    <div id="campaigns-list" style="border: 1px solid #ddd; border-radius: 4px; max-height: 400px; overflow-y: auto;">
                        <div style="padding: 20px; text-align: center; color: #666;">
                            Click "Refresh Campaigns" to load campaigns
                        </div>
                    </div>
                </div>

                <!-- Campaign Details & Posts -->
                <div style="flex: 1;">
                    <h3>Campaign Details</h3>
                    <div id="campaign-details" style="border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 16px; min-height: 120px;">
                        <div style="color: #666; text-align: center; padding: 20px;">
                            Select a campaign to view details
                        </div>
                    </div>

                    <h3>Social Posts</h3>
                    <div id="campaign-posts" style="border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">
                        <div style="padding: 20px; text-align: center; color: #666;">
                            Select a campaign to view posts
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- JSON Mode Tab -->
        <div id="json-tab" class="tab-content">
            <h2>JSON Mode</h2>
            <p>Test APIs directly with JSON payloads. Data is automatically saved to localStorage for reuse.</p>

            <div class="form-group">
                <label for="json-endpoint">Endpoint</label>
                <select id="json-endpoint" onchange="loadSavedJson()">
                    <option value="personas">POST /personas</option>
                    <option value="brands">POST /brands</option>
                    <option value="campaigns">POST /campaigns</option>
                </select>
            </div>

            <div class="form-group">
                <label for="json-payload">JSON Payload</label>
                <textarea id="json-payload" rows="20" placeholder="Enter JSON payload here..." style="font-family: monospace; font-size: 12px;"></textarea>
            </div>

            <div style="margin-bottom: 16px;">
                <button type="button" onclick="saveJsonToStorage()" style="background: #28a745; margin-right: 8px;">Save to Storage</button>
                <button type="button" onclick="loadSavedJson()" style="background: #6c757d; margin-right: 8px;">Load from Storage</button>
                <button type="button" onclick="clearJsonStorage()" style="background: #dc3545; margin-right: 8px;">Clear Storage</button>
                <button type="button" onclick="formatJson()" style="background: #17a2b8;">Format JSON</button>
            </div>

            <button type="button" onclick="submitJsonRequest()">Send Request</button>
            <div id="json-response"></div>
        </div>
    </div>

    <script>
        const API_URL = '${CONFIG.apiUrl || ''}';
        const ACCESS_TOKEN = '${token || ''}';

        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            document.querySelector(\`[onclick="showTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');

            // Load data when campaign tab is selected
            if (tabName === 'campaign' && API_URL && ACCESS_TOKEN) {
                if (brandsCache.length === 0 || personasCache.length === 0) {
                    Promise.all([loadBrands(), loadPersonas()]);
                }
            }

            // Load campaigns when campaigns tab is selected
            if (tabName === 'campaigns' && API_URL && ACCESS_TOKEN) {
                selectedCampaignId = null;
                setTimeout(() => loadCampaignsList(), 100);
            }
        }

        function updateRangeValue(rangeId, valueId) {
            const range = document.getElementById(rangeId);
            const valueSpan = document.getElementById(valueId);
            valueSpan.textContent = range.value;
        }

        function addArrayItem(containerId, placeholder) {
            const container = document.getElementById(containerId);
            const div = document.createElement('div');
            div.className = 'array-input';
            div.innerHTML = \`
                <input type="text" placeholder="\${placeholder}">
                <button type="button" onclick="removeArrayItem(this)">Remove</button>
            \`;
            container.appendChild(div);
        }

        function addPostingWindow() {
            const container = document.getElementById('posting-windows');
            const div = document.createElement('div');
            div.className = 'array-input';
            div.innerHTML = \`
                <input type="time" placeholder="Start time" style="width: 45%;">
                <input type="time" placeholder="End time" style="width: 45%;">
                <button type="button" onclick="removeArrayItem(this)">Remove</button>
            \`;
            container.appendChild(div);
        }

        function addMessagingPillar() {
            const container = document.getElementById('messaging-pillars');
            const div = document.createElement('div');
            div.className = 'array-input';
            div.innerHTML = \`
                <input type="text" placeholder="Pillar name" style="width: 60%;">
                <input type="number" placeholder="Weight (0-1)" min="0" max="1" step="0.1" style="width: 30%;">
                <button type="button" onclick="removeArrayItem(this)">Remove</button>
            \`;
            container.appendChild(div);
        }

        function addPersonaSelector() {
            const container = document.getElementById('persona-ids');
            const div = document.createElement('div');
            div.className = 'array-input';
            div.innerHTML = \`
                <select style="width: 85%;">
                    <option value="">Select a persona...</option>
                </select>
                <button type="button" onclick="removeArrayItem(this)">Remove</button>
            \`;
            container.appendChild(div);
            populatePersonaSelector(div.querySelector('select'));
        }

        let brandsCache = [];
        let personasCache = [];
        let campaignsCache = [];
        let selectedCampaignId = null;

        async function loadBrands() {
            try {
                const result = await makeRequest(\`\${API_URL}/brands\`, 'GET');
                if (result.status === 200) {
                    const data = JSON.parse(result.data);
                    brandsCache = data.brands || [];
                    populateBrandSelector();
                }
            } catch (error) {
                console.error('Failed to load brands:', error);
            }
        }

        async function loadPersonas() {
            try {
                const result = await makeRequest(\`\${API_URL}/personas\`, 'GET');
                if (result.status === 200) {
                    const data = JSON.parse(result.data);
                    personasCache = data.personas || [];
                    populatePersonaSelectors();
                }
            } catch (error) {
                console.error('Failed to load personas:', error);
            }
        }

        function populateBrandSelector() {
            const brandSelect = document.getElementById('campaign-brand');
            brandSelect.innerHTML = '<option value="">Select a brand...</option>';

            brandsCache.forEach(brand => {
                const option = document.createElement('option');
                option.value = brand.brandId;
                option.textContent = \`\${brand.name} - \${brand.ethos.substring(0, 50)}...\`;
                brandSelect.appendChild(option);
            });
        }

        function populatePersonaSelector(selectElement) {
            selectElement.innerHTML = '<option value="">Select a persona...</option>';

            personasCache.forEach(persona => {
                const option = document.createElement('option');
                option.value = persona.id;
                option.textContent = \`\${persona.name} (\${persona.role} at \${persona.company})\`;
                selectElement.appendChild(option);
            });
        }

        function populatePersonaSelectors() {
            const personaSelects = document.querySelectorAll('#persona-ids select');
            personaSelects.forEach(select => populatePersonaSelector(select));
        }

        async function loadCampaignsList() {
            const button = event?.target;
            const isManualClick = !!button;

            if (isManualClick) {
                const originalText = button.textContent;
                button.disabled = true;
                button.textContent = 'Loading...';
            }

            try {
                const result = await makeRequest(\`\${API_URL}/campaigns\`, 'GET');
                if (result.status === 200) {
                    const data = JSON.parse(result.data);
                    campaignsCache = data.campaigns || [];

                    campaignsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                    displayCampaignsList();

                    if (isManualClick) {
                        button.textContent = 'Refreshed!';
                        setTimeout(() => {
                            button.textContent = originalText;
                            button.disabled = false;
                        }, 1000);
                    }
                } else {
                    throw new Error(\`Failed to load campaigns: \${result.status}\`);
                }
            } catch (error) {
                console.error('Failed to load campaigns:', error);
                document.getElementById('campaigns-list').innerHTML = \`
                    <div style="padding: 20px; text-align: center; color: #dc3545;">
                        Error loading campaigns: \${error.message}
                    </div>
                \`;

                if (isManualClick) {
                    button.textContent = 'Error - Try Again';
                    button.disabled = false;
                }
            }
        }

        function displayCampaignsList() {
            const container = document.getElementById('campaigns-list');

            if (campaignsCache.length === 0) {
                container.innerHTML = \`
                    <div style="padding: 20px; text-align: center; color: #666;">
                        No campaigns found
                    </div>
                \`;
                return;
            }

            const campaignsHtml = campaignsCache.map(campaign => {
                const createdDate = new Date(campaign.createdAt).toLocaleDateString();
                const status = campaign.status || 'draft';
                const objective = campaign.brief?.objective || 'N/A';

                return \`
                    <div class="campaign-item" onclick="selectCampaign('\${campaign.id}')">
                        <div class="campaign-name">\${campaign.name}</div>
                        <div class="campaign-meta">
                            Created: \${createdDate} | Status: \${status} | Objective: \${objective}
                        </div>
                    </div>
                \`;
            }).join('');

            container.innerHTML = campaignsHtml;

            if (campaignsCache.length > 0 && !selectedCampaignId) {
                setTimeout(() => {
                    const firstCampaign = container.querySelector('.campaign-item');
                    if (firstCampaign) {
                        firstCampaign.click();
                    }
                }, 100);
            }
        }

        async function selectCampaign(campaignId) {
            selectedCampaignId = campaignId;

            document.querySelectorAll('.campaign-item').forEach(item => {
                item.classList.remove('selected');
            });

            event.target.closest('.campaign-item').classList.add('selected');

            await loadCampaignDetails(campaignId);
            await loadCampaignPosts(campaignId);
        }

        async function loadCampaignDetails(campaignId) {
            const container = document.getElementById('campaign-details');

            container.innerHTML = \`
                <div style="padding: 20px; text-align: center; color: #666;">
                    Loading campaign details...
                </div>
            \`;

            try {
                const result = await makeRequest(\`\${API_URL}/campaigns/\${campaignId}\`, 'GET');
                if (result.status === 200) {
                    const campaign = JSON.parse(result.data);
                    displayCampaignDetails(campaign);
                } else {
                    throw new Error(\`Failed to load campaign details: \${result.status}\`);
                }
            } catch (error) {
                console.error('Failed to load campaign details:', error);
                container.innerHTML = \`
                    <div style="padding: 20px; text-align: center; color: #dc3545;">
                        Error loading campaign details: \${error.message}
                    </div>
                \`;
            }
        }

        function displayCampaignDetails(campaign) {
            const container = document.getElementById('campaign-details');

            const startDate = campaign.schedule?.startDate ? new Date(campaign.schedule.startDate).toLocaleDateString() : 'N/A';
            const endDate = campaign.schedule?.endDate ? new Date(campaign.schedule.endDate).toLocaleDateString() : 'N/A';
            const platforms = campaign.participants?.platforms?.join(', ') || 'N/A';
            const personaCount = campaign.participants?.personaIds?.length || 0;

            container.innerHTML = \`
                <div style="margin-bottom: 12px;">
                    <strong>\${campaign.name}</strong>
                    <span style="margin-left: 12px; padding: 2px 8px; background: #e9ecef; border-radius: 12px; font-size: 12px;">
                        \${campaign.status || 'draft'}
                    </span>
                </div>
                <div style="margin-bottom: 8px; font-size: 14px;">
                    <strong>Description:</strong> \${campaign.brief?.description || 'No description'}
                </div>
                <div style="margin-bottom: 8px; font-size: 14px;">
                    <strong>Objective:</strong> \${campaign.brief?.objective || 'N/A'}
                </div>
                <div style="margin-bottom: 8px; font-size: 14px;">
                    <strong>Schedule:</strong> \${startDate} - \${endDate}
                </div>
                <div style="margin-bottom: 8px; font-size: 14px;">
                    <strong>Platforms:</strong> \${platforms}
                </div>
                <div style="font-size: 14px;">
                    <strong>Personas:</strong> \${personaCount} assigned
                </div>
            \`;
        }

        async function loadCampaignPosts(campaignId) {
            const container = document.getElementById('campaign-posts');

            container.innerHTML = \`
                <div style="padding: 20px; text-align: center; color: #666;">
                    Loading posts...
                </div>
            \`;

            try {
                const result = await makeRequest(\`\${API_URL}/campaigns/\${campaignId}/posts\`, 'GET');
                if (result.status === 200) {
                    const data = JSON.parse(result.data);
                    const posts = data.posts || [];
                    displayCampaignPosts(posts);
                } else {
                    throw new Error(\`Failed to load posts: \${result.status}\`);
                }
            } catch (error) {
                console.error('Failed to load campaign posts:', error);
                container.innerHTML = \`
                    <div style="padding: 20px; text-align: center; color: #dc3545;">
                        Error loading posts: \${error.message}
                    </div>
                \`;
            }
        }

        function displayCampaignPosts(posts) {
            const container = document.getElementById('campaign-posts');

            if (posts.length === 0) {
                container.innerHTML = \`
                    <div style="padding: 20px; text-align: center; color: #666;">
                        No posts found for this campaign
                    </div>
                \`;
                return;
            }

            posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const postsHtml = posts.map(post => {
                const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'Not scheduled';
                const content = post.content?.text || 'No content';
                const truncatedContent = content.length > 150 ? content.substring(0, 150) + '...' : content;

                return \`
                    <div class="post-item">
                        <div style="margin-bottom: 8px;">
                            <span class="post-platform">\${post.platform}</span>
                            <span class="post-status \${post.status}">\${post.status || 'draft'}</span>
                        </div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                            Scheduled: \${scheduledDate}
                        </div>
                        <div class="post-content">
                            \${truncatedContent}
                        </div>
                        \${post.topic ? \`<div style="margin-top: 8px; font-size: 12px; color: #666;"><strong>Topic:</strong> \${post.topic}</div>\` : ''}
                    </div>
                \`;
            }).join('');

            container.innerHTML = postsHtml;
        }

        async function refreshCampaignData() {
            const button = event.target;
            button.disabled = true;
            button.textContent = 'Loading...';

            try {
                await Promise.all([loadBrands(), loadPersonas()]);
                button.textContent = 'Refreshed!';
                setTimeout(() => {
                    button.textContent = 'Refresh Brands & Personas';
                    button.disabled = false;
                }, 1000);
            } catch (error) {
                button.textContent = 'Error - Try Again';
                button.disabled = false;
            }
        }

        function removeArrayItem(button) {
            button.parentElement.remove();
        }

        function collectArrayValues(containerId) {
            const container = document.getElementById(containerId);
            if (containerId === 'persona-ids') {
                const selects = container.querySelectorAll('select');
                return Array.from(selects).map(select => select.value).filter(value => value);
            } else {
                const inputs = container.querySelectorAll('input[type="text"]');
                return Array.from(inputs).map(input => input.value.trim()).filter(value => value);
            }
        }

        function collectCheckboxValues(name) {
            const checkboxes = document.querySelectorAll(\`input[name="\${name}"]:checked\`);
            return Array.from(checkboxes).map(cb => cb.value);
        }

        function collectPostingWindows() {
            const container = document.getElementById('posting-windows');
            const windows = container.querySelectorAll('.array-input');
            const result = [];

            windows.forEach(window => {
                const inputs = window.querySelectorAll('input[type="time"]');
                if (inputs.length === 2 && inputs[0].value && inputs[1].value) {
                    result.push({
                        start: inputs[0].value,
                        end: inputs[1].value
                    });
                }
            });

            return result.length > 0 ? result : null;
        }

        function collectMessagingPillars() {
            const container = document.getElementById('messaging-pillars');
            const pillars = container.querySelectorAll('.array-input');
            const result = [];

            pillars.forEach(pillar => {
                const inputs = pillar.querySelectorAll('input');
                if (inputs.length === 2 && inputs[0].value && inputs[1].value) {
                    result.push({
                        name: inputs[0].value.trim(),
                        weight: parseFloat(inputs[1].value)
                    });
                }
            });

            return result.length > 0 ? result : null;
        }

        function collectForceVisuals() {
            const checkboxes = document.querySelectorAll('input[name="forceVisuals"]:checked');
            if (checkboxes.length === 0) return null;

            const result = {
                twitter: null,
                linkedin: null,
                instagram: null,
                facebook: null
            };

            checkboxes.forEach(cb => {
                result[cb.value] = true;
            });

            return result;
        }

        async function makeRequest(url, method, data) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${ACCESS_TOKEN}\`
                    },
                    body: data ? JSON.stringify(data) : undefined
                });

                const result = await response.text();
                return {
                    status: response.status,
                    data: result
                };
            } catch (error) {
                return {
                    status: 0,
                    data: error.message
                };
            }
        }

        function showResponse(elementId, status, data) {
            const element = document.getElementById(elementId);
            element.className = \`response \${status >= 200 && status < 300 ? 'success' : 'error'}\`;
            element.textContent = \`Status: \${status}\\n\${data}\`;
        }

        document.getElementById('persona-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name'),
                role: formData.get('role'),
                company: formData.get('company'),
                primaryAudience: formData.get('primaryAudience'),
                voiceTraits: collectCheckboxValues('voiceTraits'),
                writingHabits: {
                    paragraphs: formData.get('paragraphs'),
                    questions: formData.get('questions'),
                    emojis: formData.get('emojis'),
                    structure: formData.get('structure')
                },
                opinions: {
                    strongBeliefs: collectCheckboxValues('strongBeliefs'),
                    avoidsTopics: collectCheckboxValues('avoidTopics')
                },
                language: {
                    avoid: collectCheckboxValues('languageAvoid'),
                    prefer: collectCheckboxValues('languagePrefer')
                },
                ctaStyle: {
                    aggressiveness: formData.get('ctaAggressiveness'),
                    patterns: collectCheckboxValues('ctaPatterns')
                }
            };

            const result = await makeRequest(\`\${API_URL}/personas\`, 'POST', data);
            showResponse('persona-response', result.status, result.data);
        });

        // Initialize data when page loads
        document.addEventListener('DOMContentLoaded', async () => {
            if (API_URL && ACCESS_TOKEN) {
                await Promise.all([loadBrands(), loadPersonas()]);
            }
        });

        document.getElementById('brand-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);

            const data = {
                name: formData.get('name'),
                ethos: formData.get('ethos'),
                coreValues: collectArrayValues('core-values'),
                primaryAudience: formData.get('primaryAudience'),
                voiceGuidelines: {
                    tone: collectCheckboxValues('voiceTone'),
                    style: collectCheckboxValues('voiceStyle'),
                    messaging: collectCheckboxValues('voiceMessaging')
                },
                visualIdentity: {
                    colorPalette: collectCheckboxValues('colorPalette'),
                    typography: collectCheckboxValues('typography'),
                    imagery: collectCheckboxValues('imagery')
                },
                contentStandards: {
                    qualityRequirements: collectCheckboxValues('qualityRequirements'),
                    restrictions: collectCheckboxValues('contentRestrictions')
                }
            };

            const result = await makeRequest(\`\${API_URL}/brands\`, 'POST', data);
            showResponse('brand-response', result.status, result.data);
        });

        document.getElementById('campaign-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);

            // Build CTA object
            const cta = (formData.get('ctaType') && formData.get('ctaText')) ? {
                type: formData.get('ctaType'),
                text: formData.get('ctaText'),
                url: formData.get('ctaUrl') || null
            } : null;

            // Build cadence overrides
            const cadenceOverrides = {};
            if (formData.get('minPostsPerWeek')) cadenceOverrides.minPostsPerWeek = parseInt(formData.get('minPostsPerWeek'));
            if (formData.get('maxPostsPerWeek')) cadenceOverrides.maxPostsPerWeek = parseInt(formData.get('maxPostsPerWeek'));
            if (formData.get('maxPostsPerDay')) cadenceOverrides.maxPostsPerDay = parseInt(formData.get('maxPostsPerDay'));

            // Build messaging
            const messagingPillars = collectMessagingPillars();
            const requiredInclusions = collectArrayValues('required-inclusions');
            const campaignAvoidTopics = collectArrayValues('campaign-avoid-topics');

            const messaging = (messagingPillars || requiredInclusions.length > 0 || campaignAvoidTopics.length > 0) ? {
                pillars: messagingPillars,
                requiredInclusions: requiredInclusions.length > 0 ? requiredInclusions : null,
                campaignAvoidTopics: campaignAvoidTopics.length > 0 ? campaignAvoidTopics : null
            } : null;

            // Build asset overrides
            const forceVisuals = collectForceVisuals();
            const assetOverrides = forceVisuals ? { forceVisuals } : null;

            const data = {
                name: formData.get('name'),
                brandId: formData.get('brandId') || null,
                brief: {
                    description: formData.get('description'),
                    objective: formData.get('objective'),
                    primaryCTA: cta
                },
                participants: {
                    personaIds: collectArrayValues('persona-ids'),
                    platforms: collectCheckboxValues('platforms'),
                    distribution: {
                        mode: formData.get('distributionMode') || 'balanced',
                        personaWeights: null,
                        platformWeights: null
                    }
                },
                schedule: {
                    timezone: formData.get('timezone'),
                    startDate: new Date(formData.get('startDate')).toISOString(),
                    endDate: new Date(formData.get('endDate')).toISOString(),
                    allowedDaysOfWeek: collectCheckboxValues('allowedDays'),
                    blackoutDates: null,
                    postingWindows: collectPostingWindows()
                },
                cadenceOverrides: Object.keys(cadenceOverrides).length > 0 ? cadenceOverrides : null,
                messaging,
                assetOverrides,
                metadata: {
                    source: formData.get('source') || 'api',
                    externalRef: formData.get('externalRef') || null
                }
            };

            const result = await makeRequest(\`\${API_URL}/campaigns\`, 'POST', data);
            showResponse('campaign-response', result.status, result.data);
        });

        // JSON Mode Functions
        function saveJsonToStorage() {
            const endpoint = document.getElementById('json-endpoint').value;
            const payload = document.getElementById('json-payload').value;

            if (!payload.trim()) {
                alert('Please enter a JSON payload first');
                return;
            }

            try {
                JSON.parse(payload);
                localStorage.setItem(\`json-payload-\${endpoint}\`, payload);
                alert('JSON saved to localStorage');
            } catch (error) {
                alert('Invalid JSON format');
            }
        }

        function loadSavedJson() {
            const endpoint = document.getElementById('json-endpoint').value;
            const saved = localStorage.getItem(\`json-payload-\${endpoint}\`);

            if (saved) {
                document.getElementById('json-payload').value = saved;
            } else {
                loadDefaultJson(endpoint);
            }
        }

        function loadDefaultJson(endpoint) {
            const defaults = {
                personas: \`{
  "name": "Tech Evangelist",
  "role": "Developer Relations",
  "company": "TechCorp",
  "primaryAudience": "technical",
  "voiceTraits": ["direct", "technical", "pragmatic"],
  "writingHabits": {
    "paragraphs": "medium",
    "questions": "occasional",
    "emojis": "sparing",
    "structure": "mixed"
  },
  "opinions": {
    "strongBeliefs": ["Quality over quantity", "Data-driven decisions"],
    "avoidsTopics": ["Politics", "Religion"]
  },
  "language": {
    "avoid": ["Corporate buzzwords", "Excessive superlatives"],
    "prefer": ["Clear and concise", "Technical accuracy"]
  },
  "ctaStyle": {
    "aggressiveness": "medium",
    "patterns": ["Learn more", "Get started", "Explore solutions"]
  }
}\`,
                brands: \`{
  "name": "TechCorp",
  "ethos": "Empowering developers with cutting-edge tools and transparent communication",
  "coreValues": ["Innovation", "Transparency", "Developer-first"],
  "primaryAudience": "technical",
  "voiceGuidelines": {
    "tone": ["professional", "trustworthy"],
    "style": ["clear", "data-driven"],
    "messaging": ["innovation", "reliability"]
  },
  "visualIdentity": {
    "colorPalette": ["#007bff", "#28a745"],
    "typography": ["Inter"],
    "imagery": ["modern", "clean"]
  },
  "contentStandards": {
    "qualityRequirements": ["fact-checked", "original"],
    "restrictions": ["avoid jargon", "no unsubstantiated claims"]
  }
}\`,
                campaigns: \`{
  "name": "RESP Launch Campaign",
  "brandId": null,
  "brief": {
    "description": "New RESP support was launched for Momento to meet customers where they are. We need to educate customers on why this is important",
    "objective": "launch",
    "primaryCTA": {
      "type": "Sign up for Momento",
      "text": "Try it out or get in contact",
      "url": "https://gomomento.com/contact-us"
    }
  },
  "participants": {
    "personaIds": ["persona_01KCP53NQ6QQCD00K2R9F6D5KH"],
    "platforms": ["linkedin"],
    "distribution": {
      "mode": "balanced",
      "personaWeights": null,
      "platformWeights": null
    }
  },
  "schedule": {
    "timezone": "America/Chicago",
    "startDate": "2025-12-22T12:58:00.000Z",
    "endDate": "2026-01-05T12:58:00.000Z",
    "allowedDaysOfWeek": ["mon", "tue", "wed", "thu"],
    "blackoutDates": null,
    "postingWindows": [{"start": "08:00", "end": "18:00"}]
  },
  "cadenceOverrides": {
    "minPostsPerWeek": 4,
    "maxPostsPerWeek": 7,
    "maxPostsPerDay": 2
  },
  "messaging": null,
  "assetOverrides": {
    "forceVisuals": {
      "twitter": null,
      "linkedin": true,
      "instagram": null,
      "facebook": null
    }
  },
  "metadata": {
    "source": "api",
    "externalRef": null
  }
}\`
            };

            document.getElementById('json-payload').value = defaults[endpoint] || '';
        }

        function clearJsonStorage() {
            const endpoint = document.getElementById('json-endpoint').value;
            localStorage.removeItem(\`json-payload-\${endpoint}\`);
            document.getElementById('json-payload').value = '';
            alert('Storage cleared for ' + endpoint);
        }

        function formatJson() {
            const payload = document.getElementById('json-payload').value;

            try {
                const parsed = JSON.parse(payload);
                const formatted = JSON.stringify(parsed, null, 2);
                document.getElementById('json-payload').value = formatted;
            } catch (error) {
                alert('Invalid JSON format');
            }
        }

        async function submitJsonRequest() {
            const endpoint = document.getElementById('json-endpoint').value;
            const payload = document.getElementById('json-payload').value;

            if (!payload.trim()) {
                alert('Please enter a JSON payload');
                return;
            }

            try {
                const data = JSON.parse(payload);
                const result = await makeRequest(\`\${API_URL}/\${endpoint}\`, 'POST', data);
                showResponse('json-response', result.status, result.data);

                if (result.status >= 200 && result.status < 300) {
                    saveJsonToStorage();
                }
            } catch (error) {
                showResponse('json-response', 0, 'Invalid JSON format: ' + error.message);
            }
        }

        // Load default JSON when page loads
        document.addEventListener('DOMContentLoaded', () => {
            loadSavedJson();
        });
    </script>
</body>
</html>`;
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
    console.log('1. Open scripts/test-harness-configured.html in your browser');
    console.log('2. The API URL and authorization token are pre-configured');
    console.log('3. Test all available endpoints:');
    console.log('   • Personas: Create with comprehensive voice traits and preferences');
    console.log('   • Brands: Create with personality traits and content guidelines');
    console.log('   • Campaigns: Coming soon - full campaign creation workflow');
    console.log('\n🎯 You can now create personas and brands through the comprehensive web interface!');

  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    process.exit(1);
  }
}

main();
