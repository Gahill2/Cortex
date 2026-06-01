# Microsoft Outlook OAuth (homelab)

Cortex Mail and Calendar use Microsoft Graph for Outlook / Microsoft 365 accounts.

## 1. Azure app registration

1. Open [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. **New registration**
   - Name: `Cortex Homelab`
   - Supported account types: **Personal Microsoft accounts** and **Work/school** (or your preference)
3. **Authentication → Add platform → Web**
   - Redirect URI (must match exactly):

```
https://cortex.tail4f977b.ts.net/api/microsoft/oauth/callback
```

4. **Certificates & secrets → New client secret** — copy the value immediately
5. **API permissions → Add** `Microsoft Graph` delegated:
   - `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`
   - For calendar: `Calendars.ReadWrite`

## 2. api.env

Add to `deploy/homelab/env/api.env`:

```env
MICROSOFT_CLIENT_ID=<Application (client) ID>
MICROSOFT_CLIENT_SECRET=<secret value>
MICROSOFT_REDIRECT_URI=https://cortex.tail4f977b.ts.net/api/microsoft/oauth/callback
```

Sync and redeploy:

```bash
bash scripts/sync-homelab-integrations.sh
bash scripts/homelab-deploy-api-web.sh
```

## 3. Connect in Cortex

**Mail → Add Outlook** or **Settings → Integrations**.

If the banner says Outlook is not configured, the API container is missing `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`.
