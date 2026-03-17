## Push notifications on announcement upload (PESO_WEBSITE)

To send push notifications when the website creates an announcement, the frontend calls:

- `POST /api/sendNotification`

This endpoint is a Vercel serverless function at:

- `PESO_WEBSITE/api/sendNotification.js`

### Why

The OneSignal **REST API key must not be exposed** in frontend code.
The serverless function keeps it secret using environment variables.

### Setup on Vercel

In your Vercel project settings → Environment Variables, add:

- `ONESIGNAL_APP_ID` = `5df29122-4c9c-461f-9fe1-243a62c95ad6`
- `ONESIGNAL_REST_API_KEY` = (your OneSignal REST API key)      

Redeploy the site after adding env vars.
                                                                        
### Targeting

Announcements use `targetIntent` (`job` / `scholarship` / `both`).
The serverless function targets OneSignal users by tag `intent`:

- `job` → `intent=job` OR `intent=both`
- `scholarship` → `intent=scholarship` OR `intent=both`
- `both` → All Subscribers

