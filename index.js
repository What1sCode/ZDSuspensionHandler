require('dotenv').config();
const axios = require('axios');

// Validate required environment variables on startup
const requiredEnvVars = ['ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN', 'NOREPLY_EMAILS'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}: [MISSING]`));
  process.exit(1);
}

// Zendesk API configuration
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL;
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN;

const zendeskApi = axios.create({
  baseURL: `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`,
  auth: {
    username: `${ZENDESK_EMAIL}/token`,
    password: ZENDESK_API_TOKEN
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// Validate email format
function isValidEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

// Sleep helper for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search for a user by email address
 */
async function searchUserByEmail(email) {
  try {
    const response = await zendeskApi.get('/users/search.json', {
      params: { query: email }
    });

    if (response.data.users && response.data.users.length > 0) {
      return response.data.users[0];
    }
    return null;
  } catch (error) {
    console.error(`Error searching for user ${email}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Unsuspend a user by their ID
 */
async function unsuspendUser(userId) {
  try {
    const response = await zendeskApi.put(`/users/${userId}.json`, {
      user: {
        suspended: false
      }
    });
    return response.data.user;
  } catch (error) {
    console.error(`Error unsuspending user ${userId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Check and unsuspend a user if they are suspended
 */
async function checkAndUnsuspendUser(email) {
  console.log(`\nChecking user: ${email}`);

  if (!isValidEmail(email)) {
    console.warn(`⚠ Skipping invalid email address: ${email}`);
    return { email, status: 'invalid_email' };
  }

  try {
    const user = await searchUserByEmail(email);

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return { email, status: 'not_found' };
    }

    console.log(`✓ Found user: ${user.name} (ID: ${user.id})`);

    if (user.suspended) {
      console.log(`⚠ User is suspended. Unsuspending...`);
      await unsuspendUser(user.id);
      console.log(`✓ Successfully unsuspended: ${email}`);
      return { email, status: 'unsuspended', user };
    } else {
      console.log(`✓ User is already active: ${email}`);
      return { email, status: 'already_active', user };
    }
  } catch (error) {
    console.error(`❌ Error processing ${email}:`, error.message);
    return { email, status: 'error', error: error.message };
  }
}

/**
 * Process multiple email addresses with rate limiting
 */
async function processEmails(emails) {
  console.log(`\n📧 Processing ${emails.length} email address(es)...\n`);

  const results = [];
  for (const email of emails) {
    const result = await checkAndUnsuspendUser(email.trim());
    results.push(result);
    if (emails.length > 1) await sleep(500); // 500ms delay between requests
  }

  console.log('\n📊 Summary:');
  console.log(`Total processed: ${results.length}`);
  console.log(`Unsuspended: ${results.filter(r => r.status === 'unsuspended').length}`);
  console.log(`Already active: ${results.filter(r => r.status === 'already_active').length}`);
  console.log(`Not found: ${results.filter(r => r.status === 'not_found').length}`);
  console.log(`Invalid email: ${results.filter(r => r.status === 'invalid_email').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);

  return results;
}

// Main execution
(async () => {
  const emailsToCheck = process.env.NOREPLY_EMAILS
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);

  if (emailsToCheck.length === 0) {
    console.error('❌ FATAL: NOREPLY_EMAILS is set but contains no valid entries.');
    process.exit(1);
  }

  console.log(`📋 Emails to process: ${emailsToCheck.join(', ')}`);

  try {
    await processEmails(emailsToCheck);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
