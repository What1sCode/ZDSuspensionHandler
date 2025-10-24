# Zendesk User Unsuspend Service

Automatically checks and unsuspends Zendesk users by email address. Perfect for noreply email addresses that get auto-suspended.

## Features

- 🔍 Search users by email address
- 🔓 Automatically unsuspend suspended users
- 📊 Detailed logging and summary reports
- ☁️ Easy deployment to Railway
- ⏰ Can be scheduled with Railway Cron

## Setup

### 1. Get Zendesk API Credentials

1. Log into your Zendesk account as an admin
2. Go to Admin Center → Apps and integrations → APIs → Zendesk API
3. Enable Token Access
4. Click "Add API token"
5. Copy the token (you won't see it again!)

### 2. Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials
# ZENDESK_SUBDOMAIN=your-company (from your-company.zendesk.com)
# ZENDESK_EMAIL=admin@yourcompany.com
# ZENDESK_API_TOKEN=your-token-here
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
     - `ZENDESK_EMAIL`
     - `ZENDESK_API_TOKEN`
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
- Check your API token is correct
- Ensure the API user has admin permissions

### "Rate limit exceeded"
- Zendesk API has rate limits
- Add delays between requests if processing many users
- Consider running less frequently

## Security Notes

- Never commit your `.env` file
- Keep your API token secure
- Use Railway's encrypted environment variables
- Regularly rotate API tokens

## License

MIT
