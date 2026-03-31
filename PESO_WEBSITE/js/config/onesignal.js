/**
 * OneSignal configuration for PESO Website.
 * Used for push notifications when adding programs, announcements, and on approval/decline.
 *
 * Setup:
 * 1. Create a OneSignal app at https://onesignal.com (Web Push).
 * 2. Copy your OneSignal App ID into ONESIGNAL_APP_ID below.
 * 3. For sending notifications from the app (e.g. after adding a program), use a backend
 *    (e.g. Firebase Cloud Function) that holds your REST API Key and calls OneSignal's API.
 *    Set NOTIFICATION_BACKEND_URL to that endpoint, or leave empty to disable sending.
 * 4. Add OneSignalSDKWorker.js to your site root if you use the Web SDK for subscribing users.
 */

export const OneSignalConfig = {
  /** OneSignal App ID (from OneSignal Dashboard → Settings → Keys & IDs) */
  appId: "5df29122-4c9c-461f-9fe1-243a62c95ad6",

  /** Enable/disable all OneSignal notification sending from the app */
  enabled: true,

  /**
   * Backend URL that receives notification requests and sends via OneSignal REST API.
   * Your backend must store the OneSignal REST API Key securely and call OneSignal's
   * "Create Notification" API. Leave empty to skip sending (e.g. until backend is ready).
   * Example: "https://your-project.cloudfunctions.net/sendNotification"
   */
  notificationBackendUrl: "/api/sendNotification",

  /** Optional: subdomain for OneSignal (required only for HTTP / custom setup) */
  subdomainName: "",

  /** Optional: delay SDK until user consents (GDPR) */
  requiresUserPrivacyConsent: false,
};

export default OneSignalConfig;
