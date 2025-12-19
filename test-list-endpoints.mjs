import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const API_URL = process.env.API_URL;
const envContent = readFileSync('.env', 'utf8');
const tokenMatch = envContent.match(/ACCESS_TOKEN=(.+)/);
const ACCESS_TOKEN = tokenMatch ? tokenMatch[1].trim() : null;

if (!API_URL || !ACCESS_TOKEN) {
  console.error('Missing API_URL or ACCESS_TOKEN in .env file');
  process.exit(1);
}

async function testEndpoint(name, path) {
  console.log(`\n🧪 Testing ${name}...`);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${name} - Status: ${response.status}`);
      console.log(`   Items returned: ${data.personas?.length || data.brands?.length || data.campaigns?.length || 0}`);
      console.log(`   Has next page: ${data.hasNextPage || false}`);
    } else {
      console.log(`❌ ${name} - Status: ${response.status}`);
      console.log(`   Error: ${data.message || JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
  }
}

async function testCampaignPosts() {
  console.log('\n🧪 Testing Campaign Posts...');

  // First get a list of campaigns to find one to test with
  try {
    const campaignsResponse = await fetch(`${API_URL}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });

    const campaignsData = await campaignsResponse.json();

    if (campaignsResponse.ok && campaignsData.campaigns && campaignsData.campaigns.length > 0) {
      const campaignId = campaignsData.campaigns[0].id;
      console.log(`   Found campaign to test: ${campaignId}`);

      const postsResponse = await fetch(`${API_URL}/campaigns/${campaignId}/posts`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      });

      const postsData = await postsResponse.json();

      if (postsResponse.ok) {
        console.log(`✅ Campaign Posts - Status: ${postsResponse.status}`);
        console.log(`   Posts returned: ${postsData.posts?.length || 0}`);
        console.log(`   Has next page: ${postsData.hasNextPage || false}`);
      } else {
        console.log(`❌ Campaign Posts - Status: ${postsResponse.status}`);
        console.log(`   Error: ${postsData.message || JSON.stringify(postsData)}`);
      }
    } else {
      console.log('⚠️  No campaigns found to test posts with');
    }
  } catch (error) {
    console.log(`❌ Campaign Posts - Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Testing List Endpoints\n');
  console.log(`API URL: ${API_URL}`);

  await testEndpoint('List Personas', '/personas');
  await testEndpoint('List Brands', '/brands');
  await testEndpoint('List Campaigns', '/campaigns');
  await testCampaignPosts();

  console.log('\n✅ All tests completed!');
}

runTests();
