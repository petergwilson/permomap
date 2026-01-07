# OAuth2 Setup Guide

## Overview

The application now supports OAuth2 authentication with Google, Microsoft, and LinkedIn, alongside traditional username/password login. Users can also manage their accounts with full CRUD capabilities.

## Features Implemented

### Authentication
- ✅ Google OAuth2
- ✅ Microsoft OAuth2  
- ✅ LinkedIn OAuth2
- ✅ Traditional username/password login
- ✅ Session management with PostgreSQL

### Account Management (CRUD)
- ✅ View profile information
- ✅ Update username and email
- ✅ Change password (non-OAuth users)
- ✅ Delete account
- ✅ Admin: List all users
- ✅ Admin: Delete users

## Database Setup

First, update the database schema to support OAuth:

```bash
psql -U postgres -d gis -f sql/add_oauth_support.sql
```

This adds:
- `oauth_provider` - Provider name (google, microsoft, linkedin)
- `oauth_id` - Provider's user ID
- `email` - User email address
- `created_at` / `updated_at` - Timestamps
- Indexes and constraints for OAuth fields

## OAuth Provider Setup

### 1. Google OAuth

**Create OAuth Credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Web application"
6. Authorized redirect URIs: 
   - Development: `http://localhost:3000/auth/google/callback`
   - Production: `https://yourdomain.com/auth/google/callback`
7. Copy Client ID and Client Secret

**Add to `.env`:**
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 2. Microsoft OAuth

**Create OAuth Credentials:**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Name: Your app name
5. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
6. Redirect URI: 
   - Development: `http://localhost:3000/auth/microsoft/callback`
   - Production: `https://yourdomain.com/auth/microsoft/callback`
7. After creation, go to "Certificates & secrets" → "New client secret"
8. Copy Application (client) ID and client secret value

**Add to `.env`:**
```env
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_CALLBACK_URL=http://localhost:3000/auth/microsoft/callback
```

### 3. LinkedIn OAuth

**Create OAuth Credentials:**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create a new app
3. Fill in basic information
4. In "Auth" tab, add redirect URL:
   - Development: `http://localhost:3000/auth/linkedin/callback`
   - Production: `https://yourdomain.com/auth/linkedin/callback`
5. Request "r_liteprofile" and "r_emailaddress" permissions
6. Copy Client ID and Client Secret from "Auth" tab

**Add to `.env`:**
```env
LINKEDIN_CLIENT_ID=your-client-id-here
LINKEDIN_CLIENT_SECRET=your-client-secret-here
LINKEDIN_CALLBACK_URL=http://localhost:3000/auth/linkedin/callback
```

## Environment Configuration

### Development (`.env.development`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gis
SESSION_SECRET=dev-secret-not-for-production

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3000/auth/microsoft/callback

LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=http://localhost:3000/auth/linkedin/callback
```

### Production (`.env.production`)
Same as development but with:
- `NODE_ENV=production`
- Production URLs in callback URLs
- Strong `SESSION_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## API Endpoints

### Authentication

**OAuth Login:**
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/microsoft` - Initiate Microsoft OAuth
- `GET /auth/microsoft/callback` - Microsoft OAuth callback
- `GET /auth/linkedin` - Initiate LinkedIn OAuth
- `GET /auth/linkedin/callback` - LinkedIn OAuth callback

**Traditional Login:**
- `POST /api/login` - Username/password login
- `POST /api/logout` - Logout
- `GET /api/get_session` - Get current session

### User Account Management

**User Operations:**
- `GET /api/user/profile` - Get current user profile
- `PUT /api/user/profile` - Update username/email
- `POST /api/user/change-password` - Change password (non-OAuth users only)
- `DELETE /api/user/account` - Delete own account

**Admin Operations:**
- `GET /api/admin/users` - List all users (admin only)
- `DELETE /api/admin/users/:userid` - Delete user (admin only)

## Frontend Usage

### Login Modal

The login modal now includes:
- OAuth buttons for Google, Microsoft, LinkedIn
- Traditional username/password form
- Link to account management

### Account Management

Access via "Manage Account" link in login modal. Features:
- View profile information
- Edit username and email
- Change password (traditional users only)
- Delete account

## Testing

### Test Traditional Login
```bash
# Create test user with hashed password
node backend/hash-password.js "testpassword123"

# In psql:
INSERT INTO permomap_users (username, password, email, role) 
VALUES ('testuser', '$2a$10$...', 'test@example.com', 'user');
```

### Test OAuth Login
1. Configure OAuth credentials in `.env`
2. Start server: `npm run server:dev`
3. Open browser: `http://localhost:3000`
4. Click login → Choose OAuth provider
5. Authorize app on provider's page
6. Should redirect back logged in

### Test Account Management
1. Log in with any method
2. Click "Manage Account" in login modal
3. Try editing profile, changing password, etc.

## Security Notes

1. **Never commit OAuth credentials** - Use environment variables
2. **Production secrets** - Generate strong session secret
3. **HTTPS required** - OAuth providers require HTTPS in production
4. **Password policy** - Enforce minimum 6 characters (customize as needed)
5. **Rate limiting** - Login attempts limited to 5 per 15 minutes

## Troubleshooting

### OAuth Redirect URI Mismatch
Ensure callback URLs in:
- Provider dashboard
- `.env` file
- Match exactly (including http/https, port, path)

### "No email provided by OAuth provider"
Some providers require explicit permission scopes. Check:
- Google: Ensure email scope is included
- Microsoft: Request `user.read` scope
- LinkedIn: Request `r_emailaddress` permission

### Session Not Persisting
Check:
- `permomap_session` table exists in database
- Cookie settings (secure flag for HTTPS)
- Session secret is set

### User Already Exists Error
OAuth users are matched by email. If a user exists with the same email, they'll be logged in and OAuth provider info will be added.

## File Changes

**Modified Files:**
- [backend/server.mjs](backend/server.mjs) - OAuth strategies, routes, CRUD endpoints
- [src/main.jsx](src/main.jsx) - Account management UI handlers
- [index.html](index.html) - Login and account management modals
- [style.css](style.css) - OAuth button and account management styles
- [.env.development](.env.development) - OAuth configuration
- [.env.example](.env.example) - OAuth configuration template

**New Files:**
- [sql/add_oauth_support.sql](sql/add_oauth_support.sql) - Database schema updates
- [OAUTH_SETUP.md](OAUTH_SETUP.md) - This guide

**Updated Dependencies:**
```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-microsoft": "^1.0.0",
  "passport-linkedin-oauth2": "^2.0.0"
}
```

## Next Steps

1. Apply database migrations
2. Configure OAuth credentials for desired providers
3. Update environment files
4. Test authentication flows
5. Customize UI as needed
6. Deploy to production with HTTPS
