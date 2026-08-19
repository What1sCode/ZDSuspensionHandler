# Zendesk User Unsuspend Service

Automatically checks and unsuspends Zendesk users by email address. Perfect for noreply email addresses that get auto-suspended.

## Features

- 🔍 Search users by email address
- 🔓 Automatically unsuspend suspended users
- 📊 Detailed logging and summary reports
- ☁️ Easy deployment to Railway
- ⏰ Can be scheduled with Railway Cron

## Setup

### 1. Get Zendesk OAuth Credentials

1. Log into your Zendesk account as an admin
2. Go to Admin Center → Apps and integrations → APIs → OAuth Clients
3. Add a new **confidential** OAuth client
4. Grant it the `users:read` and `users:write` scopes (that's all this service calls)
5. Copy the Unique Identifier (client ID) and Secret (you won't see the secret again!)

### 2. Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
# ZENDESK_SUBDOMAIN=your-company (from your-company.zendesk.com)
# ZENDESK_OAUTH_CLIENT_ID=your-client-id
# ZENDESK_OAUTH_CLIENT_SECRET=your-client-secret
# NOREPLY_EMAILS=noreply@example.com,no-reply@example.com

# Run the script
npm start
```

### 3. Deploy to Railway

1. **Create a new project in Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Connect this repository

2. **Add Environment Variables**
   - In Railway project settings, go to "Variables"
   - Add all variables from `.env.example`:
     - `ZENDESK_SUBDOMAIN`
     - `ZENDESK_OAUTH_CLIENT_ID`
     - `ZENDESK_OAUTH_CLIENT_SECRET`
     - `NOREPLY_EMAILS`

3. **Configure the service**
   - Railway will auto-detect Node.js and run `npm start`
   - The service will run once when deployed

4. **Schedule it (Optional)**
   - To run this regularly, use Railway's Cron Jobs
   - Create a Cron service in Railway
   - Set schedule (e.g., `0 */6 * * *` for every 6 hours)
   - Command: `npm start`

## How It Works

1. Reads email addresses from `NOREPLY_EMAILS` environment variable
2. For each email:
   - Searches for the user in Zendesk
   - Checks if they're suspended
   - Unsuspends them if needed
3. Outputs a summary report

## Example Output

```
📧 Processing 3 email address(es)...

Checking user: noreply@example.com
✓ Found user: No Reply (ID: 12345)
⚠ User is suspended. Unsuspending...
✓ Successfully unsuspended: noreply@example.com

Checking user: notifications@example.com
✓ Found user: Notifications (ID: 67890)
✓ User is already active: notifications@example.com

📊 Summary:
Total processed: 3
Unsuspended: 1
Already active: 1
Not found: 0
Errors: 0
```

## Customization

### Add More Emails

Edit the `NOREPLY_EMAILS` environment variable:
```
NOREPLY_EMAILS=noreply@domain.com,no-reply@domain.com,alerts@domain.com,system@domain.com
```

### Run on a Schedule

With Railway Cron or any cron service:
```
# Every 6 hours
0 */6 * * *

# Daily at 3 AM
0 3 * * *

# Every hour
0 * * * *
```

## Troubleshooting

### "User not found"
- Verify the email address is correct
- Check if the user exists in Zendesk

### "Authentication failed"
- Verify your Zendesk subdomain
- Check your OAuth client ID/secret are correct and the client is confidential
- Ensure the OAuth client's scopes include `users:read` and `users:write`
- The client_credentials token is attributed to whichever Zendesk user created the OAuth client — confirm that account has the necessary permissions

### "Rate limit exceeded"
- Zendesk API has rate limits
- Add delays between requests if processing many users
- Consider running less frequently

## Security Notes

- Never commit your `.env` file
- Keep your OAuth client secret secure
- Use Railway's encrypted environment variables
- Scope the OAuth client to only `users:read`/`users:write` — least privilege for what this service does

## License

MIT
