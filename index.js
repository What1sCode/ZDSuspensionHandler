require('dotenv').config();
const axios = require('axios');

// Validate required environment variables on startup
const requiredEnvVars = ['ZENDESK_SUBDOMAIN', 'ZENDESK_OAUTH_CLIENT_ID', 'ZENDESK_OAUTH_CLIENT_SECRET', 'NOREPLY_EMAILS'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingVars.forEach(v => console.error(`   - ${v}: [MISSING]`));
  process.exit(1);
}

// Zendesk API configuration
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN;
const OAUTH_CLIENT_ID = process.env.ZENDESK_OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.ZENDESK_OAUTH_CLIENT_SECRET;
const ZENDESK_DOMAIN = `https://${ZENDESK_SUBDOMAIN}.zendesk.com`;

const zendeskApi = axios.create({
  baseURL: `${ZENDESK_DOMAIN}/api/v2`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Fetch an OAuth access token via the client_credentials grant.
// This is a one-shot script, so we just get a token once per run rather
// than maintaining a cache/refresh cycle.
async function fetchAccessToken() {
  const response = await axios.post(`${ZENDESK_DOMAIN}/oauth/tokens`, {
    grant_type: 'client_credentials',
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    scope: 'users:read users:write'
  });
  return response.data.access_token;
}

// Retry once with a fresh token if it's rejected mid-run (e.g. expired on a long list).
zendeskApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response && error.response.status === 401 && config && !config._retriedOAuth) {
      config._retriedOAuth = true;
      const token = await fetchAccessToken();
      zendeskApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      config.headers['Authorization'] = `Bearer ${token}`;
      return zendeskApi(config);
    }
    return Promise.reject(error);
  }
);

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
    const token = await fetchAccessToken();
    zendeskApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    await processEmails(emailsToCheck);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
