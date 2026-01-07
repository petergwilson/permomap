# Permomap User Roles Documentation

## Overview
Permomap uses a hierarchical role-based access control (RBAC) system to manage user permissions. This document describes the four role levels and their capabilities.

## Role Hierarchy

### 1. Public (Unauthenticated)
**Access Level:** Read-only

**Capabilities:**
- View all tracks on the map (permolat_tracks, doc_tracks, doc_huts)
- View basic track information
- No editing capabilities
- No account required

**Use Case:** General public browsing the track network

---

### 2. User (Authenticated)
**Access Level:** Read and Edit

**Capabilities:**
- All public capabilities, plus:
- Edit permolat_tracks (community tracks)
- Create new track entries
- Update track conditions, maintenance dates, and descriptions
- Cannot edit doc_tracks or doc_huts (DOC-managed layers)
- Cannot approve/reject changes from other users
- Changes are submitted for moderation

**Use Case:** Community members who maintain and update track information

**How to Get:** Sign up via OAuth (Google, Microsoft, LinkedIn) or username/password

---

### 3. Moderator
**Access Level:** Review and Approve

**Capabilities:**
- All user capabilities, plus:
- View pending changes from other users (shown in different color on map)
- Approve changes (roll forward) to make them live
- Reject changes (roll back) to previous versions
- View complete edit history with timestamps and user attribution
- Schedule maintenance tasks
- Update maintenance status
- Access moderation panel with extended track metadata

**Use Case:** Track custodians and community moderators who review and approve edits

**How to Get:** Promoted by a sysadmin

---

### 4. Sysadmin (System Administrator)
**Access Level:** Full System Access

**Capabilities:**
- All moderator capabilities, plus:
- Manage user accounts (view all users, delete users)
- Change user roles (promote users to moderator)
- Access system admin panel
- Delete features from the database
- Change feature permissions
- View system status and logs
- Cannot self-promote to sysadmin (requires existing sysadmin)

**Use Case:** System administrators who manage the platform

**How to Get:** Promoted by an existing sysadmin or database administrator

---

## Implementation Details

### Database
Roles are stored in the `permomap_users` table with the `role` column using a PostgreSQL ENUM type:

```sql
CREATE TYPE user_role_type AS ENUM ('public', 'user', 'moderator', 'sysadmin');
```

### Backend (server.mjs)
- Role is stored in the session: `req.session.role`
- Protected endpoints check role before allowing access
- OAuth users default to 'user' role

### Frontend (main.jsx)
- Role is stored in: `window.session_info.role`
- UI elements show/hide based on role
- Different CSS classes apply based on role:
  - `permomap_style_public` - Read-only styling
  - `permomap_style_users` - Editable field styling
  - `permomap_style_moderator` - Enhanced metadata display

### CSS Styling
Three style classes correspond to roles:
- `.permomap_style_public` - Compact, read-only appearance
- `.permomap_style_users` - Editable fields with borders and hover effects
- `.permomap_style_moderator` - Extra spacing for edit metadata

### Special Rules
1. **DOC Layers:** All users see doc_tracks and doc_huts as read-only (public styling), regardless of their role
2. **Custodian Field:** If a track has a custodian assigned, that field becomes non-editable for regular users
3. **Role Changes:** Users cannot promote themselves to sysadmin (enforced by database trigger)

---

## Migration from 'admin' to 'sysadmin'

The system previously used 'admin' as the highest role. This has been updated to 'sysadmin' for clarity.

### Migration Steps:
1. Run the SQL migration: `sql/define_user_roles.sql`
2. This will automatically convert all 'admin' users to 'sysadmin'
3. Backend and frontend code has been updated to use 'sysadmin'

---

## Permission Checking

### Database Function
A helper function is available for permission checks:

```sql
SELECT has_permission(user_id, 'required_role');
```

This returns `true` if the user's role meets or exceeds the required role level.

### Frontend Check
```javascript
// Check if user has moderator or higher privileges
if (window.session_info?.role === 'moderator' || window.session_info?.role === 'sysadmin') {
    // Show moderator features
}
```

### Backend Check
```javascript
// Require sysadmin role
if (req.session.role !== 'sysadmin') {
    return res.status(403).json({ message: 'System administrator access required' });
}
```

---

## Role Assignment

### New Users
- OAuth signups: Automatically assigned 'user' role
- Username/password signups: Assigned 'user' role (if that feature is enabled)

### Promoting Users
Only sysadmins can promote users. This is done through:
1. Direct database update (by database admin)
2. Admin API endpoint (future feature)
3. Admin UI panel (future feature)

Example SQL to promote a user:
```sql
UPDATE permomap_users 
SET role = 'moderator' 
WHERE email = 'user@example.com';
```

---

## Security Considerations

1. **Role Validation:** Database trigger prevents self-promotion to sysadmin
2. **Session Storage:** Role is stored in PostgreSQL session, not in client-side cookie
3. **Backend Verification:** All protected endpoints verify role before allowing access
4. **No Default Sysadmin:** System does not create default admin accounts
5. **Audit Trail:** All role changes should be logged (future enhancement)

---

## Future Enhancements

- [ ] Admin UI for user management
- [ ] Role change audit logging
- [ ] Granular permissions (e.g., track-specific custodians)
- [ ] Team/group-based permissions
- [ ] Time-limited role assignments
- [ ] Role-based notification settings

---

## Support

For questions about role assignment or permissions, contact the system administrator.

To request a role upgrade (user → moderator), provide:
- Your email address
- Reason for upgrade request
- Experience with track maintenance
