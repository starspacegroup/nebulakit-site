# GitHub OAuth Configuration Guide

## Overview

NebulaKit now supports GitHub OAuth authentication. Once configured, users can sign in with their GitHub account, and the OAuth app owner will have access to the admin panel.

## Setup Process

### 1. Create GitHub OAuth App

**IMPORTANT:** You must create a real GitHub OAuth App first. The app will not work with mock credentials.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the application details:
   - **Application name**: NebulaKit (or your preferred name)
   - **Homepage URL**: `http://localhost:4278` (for development)
   - **Authorization callback URL**: `http://localhost:4278/api/auth/github/callback`
4. Click **"Register application"**
5. You'll see your **Client ID** on the next page
6. Click **"Generate a new client secret"** to get your **Client Secret**
7. Copy both values immediately (you won't be able to see the secret again)

### 2. Configure Locally (Development)

For local development, you have two options:

**Option A: Using .dev.vars (Recommended for local testing)**

Create a `.dev.vars` file in the project root:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_OWNER_ID=your_github_user_id_here
SESSION_SECRET=generate_a_random_secret_here
SETUP_SECRET=generate_a_different_random_secret_here
```

**Option B: Using wrangler.toml**

Add or uncomment in `wrangler.toml` under the `[vars]` section:

```toml
[vars]
GITHUB_OWNER_ID = "your_github_user_id_here"
```

**Option C: Using the /setup page**

Set `SESSION_SECRET` and `SETUP_SECRET`, then visit `/setup` and enter the setup secret, OAuth
credentials, and owner username. Once an owner or provider configuration exists, only the
authenticated owner can change setup.

#### Finding Your GitHub User ID

To enable admin access, you need to set your GitHub user ID. Here's how to find it:

**Method 1: GitHub API (Easiest)**
Visit: `https://api.github.com/users/YOUR_USERNAME`

Look for the `"id"` field in the JSON response (it's a number, not a string).

**Method 2: Using curl/PowerShell**

```powershell
# PowerShell
(Invoke-WebRequest "https://api.github.com/users/YOUR_USERNAME").Content | ConvertFrom-Json | Select-Object id

# Or use curl
curl https://api.github.com/users/YOUR_USERNAME
```

**Example:**

```json
{
  "login": "octocat",
  "id": 583231,  // <-- This is your GITHUB_OWNER_ID
  "name": "The Octocat",
  ...
}
```

### 3. Environment Variables (Production)

For Cloudflare Workers deployment, set these environment variables:

```bash
# Set secrets (for sensitive data)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put SETUP_SECRET

# Set vars (can be public, defined in wrangler.toml or set via CLI)
wrangler secret put GITHUB_OWNER_ID
```

Or update `wrangler.toml`:

```toml
[vars]
GITHUB_OWNER_ID = "583231"  # Replace with your actual GitHub user ID
```

**Environment Variable Details:**

- `GITHUB_CLIENT_ID`: Your GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth App Client Secret
- `GITHUB_OWNER_ID`: Your GitHub user ID (numeric) - **only this user can access /admin**
- `SESSION_SECRET`: Random secret used to sign the OAuth state cookie
- `SETUP_SECRET`: Separate bearer secret accepted only during first-time bootstrap

⚠️ **Important:** Without setting `GITHUB_OWNER_ID`, you will be able to log in with GitHub, but `isOwner` will be `false` and you won't have admin access.

## How It Works

### Authentication Flow

1. **Login**: User clicks "Continue with GitHub" on `/auth/login`
2. **OAuth**: User is redirected to GitHub to authorize the app
3. **Callback**: GitHub redirects back to `/api/auth/github/callback` with an authorization code
4. **State check**: The signed state cookie and an unexpired one-time `oauth_transactions` row must both match; the row is consumed after the provider answers, so a callback cannot be replayed
5. **Token Exchange and User Info**: The app exchanges the code for an access token, fetches the user from the GitHub API, and does not store the token
6. **Session**: An opaque token goes in the cookie; its digest, expiry and identity are stored in D1
7. **Redirect**:
   - If user is the OAuth app owner → redirected to `/admin`
   - Otherwise → redirected to home page

### Admin Access Control

- **Protected Routes**: All routes under `/admin` require authentication
- **Owner-Only**: Only the GitHub user whose numeric id is `GITHUB_OWNER_ID` is the owner (a username can be released and reclaimed, so it only counts when no id is set)
- **Server-Side Check**: Protection is enforced server-side in `+layout.server.ts`

### User Interface

- **Navigation**: Shows "Admin" link only for the OAuth app owner
- **User Menu**: Displays logged-in user's name and logout button
- **Sign In**: Shows "Sign In" button for unauthenticated users

## Routes

- `/setup` - Initial setup page for GitHub OAuth configuration
- `/auth/login` - Login page with GitHub OAuth button
- `/auth/logout` - Logout endpoint (GET or POST)
- `/api/auth/github` - OAuth initiation (redirects to GitHub)
- `/api/auth/github/callback` - OAuth callback handler
- `/admin` - Admin panel (owner-only)

## Security Features

- **Session Cookies**: HTTP-only, secure (in production), SameSite=lax
- **Owner Verification**: Compares GitHub user ID with stored owner ID
- **Server-Side Protection**: All admin routes protected by layout load function
- **Token Security**: Access tokens never stored in browser

## Testing

All authentication features are covered by tests:

```bash
# Run auth-related tests
npm run test -- github-auth admin-protection

# All tests should pass:
# ✓ github-auth.test.ts (9 tests)
# ✓ admin-protection.test.ts (6 tests)
```

## Development

The implementation follows TDD principles with 100% test coverage for auth logic.

### Key Files

- `src/hooks.server.ts` - Authentication hook
- `src/routes/api/auth/github/+server.ts` - OAuth initiation
- `src/routes/api/auth/github/callback/+server.ts` - OAuth callback
- `src/routes/admin/+layout.server.ts` - Admin route protection
- `src/lib/components/Navigation.svelte` - User menu and conditional admin link

## Production Considerations

1. **Secrets Management**: Use Cloudflare Workers secrets, never commit credentials
2. **Session Storage**: Apply the D1 migrations before enabling login; authentication fails closed without D1
3. **Secret Separation**: Use different high-entropy values for `SESSION_SECRET` and `SETUP_SECRET`; stored AI and OAuth client secrets are encrypted (see [SECURITY.md](./SECURITY.md))
4. **HTTPS**: Always use HTTPS in production for secure cookies
5. **Error Handling**: Implement proper error logging and user feedback

