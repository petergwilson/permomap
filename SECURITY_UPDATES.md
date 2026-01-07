# Security Updates Migration Guide

## Changes Implemented

### 1. Password Security
- ✅ Passwords now use bcrypt hashing instead of plain text
- ✅ Login attempts are rate-limited (5 attempts per 15 minutes)
- ✅ Generic error messages prevent user enumeration

### 2. SQL Injection Prevention
- ✅ All SQL queries now use parameterized queries
- ✅ No more string interpolation in SQL statements
- ✅ Input validation on all endpoints

### 3. Authentication & Authorization
- ✅ Authentication middleware (`requireAuth`) added
- ✅ Protected routes: `/api/save`, `/api/rollback`, `/api/rollforward`
- ✅ Session improvements with secure cookie settings

### 4. Security Headers & Protection
- ✅ Helmet.js for security headers
- ✅ Request body size limits (10MB)
- ✅ httpOnly, secure, and sameSite cookie flags

### 5. Transaction Management
- ✅ Database transactions for multi-step operations
- ✅ Proper rollback on errors
- ✅ Connection pooling optimization

### 6. Code Quality
- ✅ Removed commented-out code
- ✅ Consistent error handling
- ✅ Proper connection management (connect/release)

## Migration Steps Required

### Step 1: Update Existing Passwords
All existing plain-text passwords in your database need to be hashed.

Use the provided utility:
```bash
node backend/hash-password.js "YourPassword123"
```

Then update your database:
```sql
UPDATE permomap_users 
SET password = '$2a$10$...' -- Use the hash from the utility
WHERE username = 'your-username';
```

### Step 2: Create Environment File
```bash
cp .env.example .env
```

Edit `.env` and set:
- `SESSION_SECRET` - Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DATABASE_URL` - Your PostgreSQL connection string
- `NODE_ENV` - Set to 'production' when deploying

### Step 3: Install Dependencies
Already completed:
```bash
npm install helmet express-rate-limit
```

### Step 4: Load Environment Variables
Update your server startup to load environment variables:

```bash
# Development
NODE_ENV=development node backend/server.mjs

# Or install dotenv if needed:
npm install dotenv
```

Then add to top of server.mjs (if using dotenv):
```javascript
import 'dotenv/config';
```

### Step 5: Test Authentication
1. Hash existing test user passwords
2. Test login with new hashed passwords
3. Verify rate limiting works (try 6+ failed logins)
4. Test that protected routes require authentication

### Step 6: Database Session Table
Ensure the `permomap_session` table exists:
```sql
CREATE TABLE IF NOT EXISTS "permomap_session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "permomap_session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "permomap_session" ("expire");
```

## Breaking Changes

### API Responses
All error responses now have consistent format:
```json
{
  "success": false,
  "message": "Error description"
}
```

### Authentication Required
These endpoints now require authentication:
- `POST /api/save`
- `POST /api/rollback`
- `POST /api/rollforward`

Unauthenticated requests will receive:
```json
{
  "ok": false,
  "message": "Authentication required"
}
```

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate and set strong `SESSION_SECRET`
- [ ] Update `DATABASE_URL` for production database
- [ ] Hash all existing user passwords
- [ ] Enable HTTPS (required for secure cookies)
- [ ] Review and adjust rate limit settings
- [ ] Set up CORS if frontend is on different domain
- [ ] Monitor error logs for any issues
- [ ] Consider adding request logging middleware

## Testing Commands

```bash
# Hash a password
node backend/hash-password.js "TestPassword123"

# Test the server
node backend/server.mjs

# Test login (should fail with plain password)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"plaintext"}'

# Test rate limiting (run this 6 times quickly)
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"wrong"}'
```

## Rollback Plan

If you need to rollback, the previous version is in your git history:
```bash
git log --oneline backend/server.mjs
git checkout <commit-hash> backend/server.mjs
```

## Questions or Issues?

Review the changes in [server.mjs](backend/server.mjs) for details on the implementation.
