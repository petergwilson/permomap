import express from 'express';
import { Pool } from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
//import multer from 'multer';

const app = express();

//Port for the application, either process.env.PORT variable or 3000
//process.env.PORT may be able to be set at run time, don't know
const PORT = process.env.PORT || 3000;
const DATABASE_NAME = process.env.DATABASE_NAME || 'gis';
const BASE_PATH = process.env.BASE_PATH || '';

// PostgreSQL connection info
//Adjust if necessary if database parameters change
//FOR INSTANCE, production server database name is "postgres", testing version "gis"
//FIX THIS OR BRING IN DEPLOYMENT BUILD LOGIC
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gis',
});

//Session and cookie variables


//pgSession (postgresql session/state store)
app.use(cookieParser());

const PgSessionStore = connectPgSimple(session);

const store = new PgSessionStore({
  pool: pool,
  tableName: 'permomap_session', //pg table name for session information
});

const sessionMiddleware=session({
    secret: process.env.SESSION_SECRET || 'ForestServiceTracksAreBest-CHANGE-IN-PRODUCTION',
    store:store,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

app.use(sessionMiddleware);

// Security middleware
app.use(helmet());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.userid);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query(
            'SELECT userid, username, email, role FROM permomap_users WHERE userid = $1',
            [id]
        );
        done(null, result.rows[0]);
    } catch (error) {
        done(error);
    }
});

// Helper function to find or create OAuth user
async function findOrCreateOAuthUser(profile, provider) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const displayName = profile.displayName || profile.username || 'User';
    
    if (!email) {
        throw new Error('No email provided by OAuth provider');
    }

    try {
        // Check if user exists
        let user = await pool.query(
            'SELECT userid, username, email, role, oauth_provider FROM permomap_users WHERE email = $1',
            [email]
        );

        if (user.rows.length > 0) {
            // Existing user found
            // Update OAuth provider and updated_at timestamp if not set
            if (!user.rows[0].oauth_provider) {
                await pool.query(
                    `UPDATE permomap_users 
                     SET oauth_provider = $1, oauth_id = $2, updated_at = NOW() 
                     WHERE userid = $3`,
                    [provider, profile.id, user.rows[0].userid]
                );
                console.log(`Updated OAuth provider for existing user: ${email} (${provider})`);
            } else {
                // Just update the last login timestamp
                await pool.query(
                    'UPDATE permomap_users SET updated_at = NOW() WHERE userid = $1',
                    [user.rows[0].userid]
                );
            }
            return user.rows[0];
        }

        // Create new user with OAuth
        // Split displayName into firstname and lastname
        const nameParts = displayName.trim().split(' ');
        const firstname = nameParts[0] || displayName;
        const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : displayName;
        const userinitial = firstname.charAt(0).toUpperCase() + (lastname ? lastname.charAt(0).toUpperCase() : '');
        
        // Generate a random color for the user (for edit tracking)
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        const usercolor = colors[Math.floor(Math.random() * colors.length)];
        
        const result = await pool.query(
            `INSERT INTO permomap_users (
                username, email, role, oauth_provider, oauth_id, 
                password, status, active, firstname, lastname, userinitial, usercolor, 
                created_at, updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             RETURNING userid, username, email, role, created_at`,
            [
                displayName,           // username
                email,                 // email
                'user',                // role (default for new OAuth users)
                provider,              // oauth_provider (google, microsoft, linkedin)
                profile.id,            // oauth_id
                '',                    // password (empty for OAuth users)
                'active',              // status
                true,                  // active
                firstname,             // firstname
                lastname,              // lastname
                userinitial,           // userinitial
                usercolor              // usercolor
            ]
        );
        
        console.log(`New OAuth user created: ${email} (${provider}) at ${new Date().toISOString()}`);
        return result.rows[0];
    } catch (error) {
        throw new Error('Database error: ' + error.message);
    }
}

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateOAuthUser(profile, 'google');
            done(null, user);
        } catch (error) {
            done(error);
        }
    }));
}

// Microsoft OAuth Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL || `${BASE_PATH}/auth/microsoft/callback`,
        scope: ['user.read']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateOAuthUser(profile, 'microsoft');
            done(null, user);
        } catch (error) {
            done(error);
        }
    }));
}

// LinkedIn OAuth Strategy
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: process.env.LINKEDIN_CALLBACK_URL || `${BASE_PATH}/auth/linkedin/callback`,
        scope: ['r_emailaddress', 'r_liteprofile']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateOAuthUser(profile, 'linkedin');
            done(null, user);
        } catch (error) {
            done(error);
        }
    }));
}

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Too many login attempts, please try again later'
});

// Middleware to parse JSON bodies with size limit
app.use(express.json({ type: 'application/json', limit: '10mb' }));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userid) {
        return res.status(401).json({ ok: false, message: 'Authentication required' });
    }
    next();
};

// Input validation helper
const validateInput = (data, requiredFields) => {
    for (const field of requiredFields) {
        if (!data[field]) {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }
    return { valid: true };
};

/*
*Login
*/

// OAuth Routes
console.log('Registering OAuth routes with BASE_PATH:', BASE_PATH);

// Google OAuth
app.get(`${BASE_PATH}/auth/google`,
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(`${BASE_PATH}/auth/google/callback`,
    passport.authenticate('google', { failureRedirect: `${BASE_PATH}/?login=failed` }),
    (req, res) => {
        req.session.userid = req.user.userid;
        req.session.username = req.user.username;
        req.session.role = req.user.role;
        // In development, redirect to Vite dev server; in production, use BASE_PATH
        const redirectUrl = process.env.NODE_ENV === 'development' 
            ? `http://localhost:5173${BASE_PATH}/?oauth=success`
            : `${BASE_PATH}/?oauth=success`;
        res.redirect(redirectUrl);
    }
);

// Microsoft OAuth
app.get(`${BASE_PATH}/auth/microsoft`,
    passport.authenticate('microsoft', { scope: ['user.read'] })
);

app.get(`${BASE_PATH}/auth/microsoft/callback`,
    passport.authenticate('microsoft', { failureRedirect: `${BASE_PATH}/?login=failed` }),
    (req, res) => {
        req.session.userid = req.user.userid;
        req.session.username = req.user.username;
        req.session.role = req.user.role;
        const redirectUrl = process.env.NODE_ENV === 'development' 
            ? `http://localhost:5173${BASE_PATH}/?oauth=success`
            : `${BASE_PATH}/?oauth=success`;
        res.redirect(redirectUrl);
    }
);

// LinkedIn OAuth
app.get(`${BASE_PATH}/auth/linkedin`,
    passport.authenticate('linkedin')
);

app.get(`${BASE_PATH}/auth/linkedin/callback`,
    passport.authenticate('linkedin', { failureRedirect: `${BASE_PATH}/?login=failed` }),
    (req, res) => {
        req.session.userid = req.user.userid;
        req.session.username = req.user.username;
        req.session.role = req.user.role;
        const redirectUrl = process.env.NODE_ENV === 'development' 
            ? `http://localhost:5173${BASE_PATH}/?oauth=success`
            : `${BASE_PATH}/?oauth=success`;
        res.redirect(redirectUrl);
    }
);

// Traditional username/password login


app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    const validation = validateInput(req.body, ['username', 'password']);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, message: validation.message });
    }

    // Get user from database
    const user = await pool.query(
      'SELECT username, password, role, userid FROM permomap_users WHERE username = $1',
      [username]
    );
    
    // Check if user exists and password matches
    if (user.rows.length > 0) {
      const isValidPassword = await bcrypt.compare(password, user.rows[0].password);
      
      if (isValidPassword) {
        // Set session data
        req.session.userid = user.rows[0].userid;
        req.session.username = user.rows[0].username;
        req.session.role = user.rows[0].role;

        return res.status(200).json({ 
          ok: true, 
          message: 'Login successful',
          username: user.rows[0].username,
          userid: user.rows[0].userid,
          role: user.rows[0].role
        });
      }
    }
    
    // Generic error message to prevent user enumeration
    res.status(401).json({ ok: false, message: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});


app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
          return res.status(500).json({ok:false,message: 'Could not log out' });
        }
        res.status(200).json({ ok:true, message: 'Logged out successfully' });
      });
  });


// Example route to get session data
app.get('/api/get_session', (req, res) => {
  if (req.session.username) {
      res.status(200).json({ 
        ok: true, 
        username: req.session.username,
        userid: req.session.userid,
        role: req.session.role
      });
  } else {
    res.status(200).json({ ok: false, message: 'Not authenticated' });
  }
});

// User Account Management (CRUD)

// Get current user profile
app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT userid, username, email, role, oauth_provider, created_at, updated_at 
             FROM permomap_users WHERE userid = $1`,
            [req.session.userid]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }
        
        res.status(200).json({ ok: true, user: result.rows[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Update user profile
app.put('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const { username, email } = req.body;
        
        // Validate input
        if (!username && !email) {
            return res.status(400).json({ ok: false, message: 'No fields to update' });
        }
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (username) {
            updates.push(`username = $${paramCount++}`);
            values.push(username);
        }
        
        if (email) {
            // Check if email is already taken
            const existingUser = await pool.query(
                'SELECT userid FROM permomap_users WHERE email = $1 AND userid != $2',
                [email, req.session.userid]
            );
            
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ ok: false, message: 'Email already in use' });
            }
            
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(req.session.userid);
        
        const query = `
            UPDATE permomap_users 
            SET ${updates.join(', ')}
            WHERE userid = $${paramCount}
            RETURNING userid, username, email, role
        `;
        
        const result = await pool.query(query, values);
        
        // Update session
        if (username) req.session.username = username;
        
        res.status(200).json({ 
            ok: true, 
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Change password (for non-OAuth users)
app.post('/api/user/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                ok: false, 
                message: 'Current and new passwords are required' 
            });
        }
        
        // Get user
        const user = await pool.query(
            'SELECT password, oauth_provider FROM permomap_users WHERE userid = $1',
            [req.session.userid]
        );
        
        if (user.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }
        
        // Check if OAuth user
        if (user.rows[0].oauth_provider) {
            return res.status(400).json({ 
                ok: false, 
                message: 'Cannot change password for OAuth users' 
            });
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.rows[0].password);
        if (!isValid) {
            return res.status(401).json({ ok: false, message: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await pool.query(
            'UPDATE permomap_users SET password = $1, updated_at = NOW() WHERE userid = $2',
            [hashedPassword, req.session.userid]
        );
        
        res.status(200).json({ ok: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Get user settings (email preferences)
app.get('/api/user/settings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT userid, username, email, role, 
                    COALESCE(email_updates, true) as email_updates,
                    COALESCE(email_newsletter, true) as email_newsletter
             FROM permomap_users WHERE userid = $1`,
            [req.session.userid]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }
        
        res.status(200).json({ ok: true, settings: result.rows[0] });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Update user settings (email preferences)
app.put('/api/user/settings', requireAuth, async (req, res) => {
    try {
        const { email_updates, email_newsletter } = req.body;
        
        await pool.query(
            `UPDATE permomap_users 
             SET email_updates = $1, 
                 email_newsletter = $2,
                 updated_at = NOW()
             WHERE userid = $3`,
            [email_updates, email_newsletter, req.session.userid]
        );
        
        res.status(200).json({ ok: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Unsubscribe from all emails - logs the action
app.post('/api/user/unsubscribe', requireAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        const userid = req.session.userid;
        
        // Get user info for logging
        const userResult = await pool.query(
            'SELECT username, email FROM permomap_users WHERE userid = $1',
            [userid]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Update user preferences to unsubscribe
        await pool.query(
            `UPDATE permomap_users 
             SET email_updates = false, 
                 email_newsletter = false,
                 updated_at = NOW()
             WHERE userid = $1`,
            [userid]
        );
        
        // Log the unsubscribe action in the database
        await pool.query(
            `INSERT INTO permomap_user_activity_log 
             (userid, action_type, action_details, ip_address, user_agent, created_at)
             VALUES ($1, 'unsubscribe', $2, $3, $4, NOW())`,
            [
                userid,
                JSON.stringify({
                    reason: reason || 'User requested unsubscribe',
                    username: user.username,
                    email: user.email,
                    timestamp: new Date().toISOString()
                }),
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent')
            ]
        );
        
        console.log(`User ${user.username} (${user.email}) unsubscribed at ${new Date().toISOString()}`);
        
        res.status(200).json({ ok: true, message: 'Successfully unsubscribed from all emails' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Delete user account
app.delete('/api/user/account', requireAuth, async (req, res) => {
    try {
        const { password } = req.body;
        
        // Get user
        const user = await pool.query(
            'SELECT password, oauth_provider FROM permomap_users WHERE userid = $1',
            [req.session.userid]
        );
        
        if (user.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }
        
        // Verify password if not OAuth user
        if (!user.rows[0].oauth_provider && password) {
            const isValid = await bcrypt.compare(password, user.rows[0].password);
            if (!isValid) {
                return res.status(401).json({ ok: false, message: 'Password is incorrect' });
            }
        }
        
        // Delete user
        await pool.query('DELETE FROM permomap_users WHERE userid = $1', [req.session.userid]);
        
        // Destroy session
        req.session.destroy();
        
        res.status(200).json({ ok: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Admin: Get all users (admin only)
app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'sysadmin') {
            return res.status(403).json({ ok: false, message: 'System administrator access required' });
        }
        
        const result = await pool.query(
            `SELECT userid, username, email, role, oauth_provider, created_at, updated_at 
             FROM permomap_users 
             ORDER BY created_at DESC`
        );
        
        res.status(200).json({ ok: true, users: result.rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// Admin: Delete user (admin only)
app.delete('/api/admin/users/:userid', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'sysadmin') {
            return res.status(403).json({ ok: false, message: 'System administrator access required' });
        }
        
        const { userid } = req.params;
        
        await pool.query('DELETE FROM permomap_users WHERE userid = $1', [userid]);
        
        res.status(200).json({ ok: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});


// Route to handle GeoJSON data
// Main saving logic - saves to permolat_track_versions
app.post('/api/save', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        // Validate required properties
        if (!req.body.geometry || !req.body.properties) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid GeoJSON: missing geometry or properties' 
            });
        }

        const props = req.body.properties;
        
        // Validate parent_id (properties.id) is provided
        if (!props.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Parent track ID (properties.id) is required' 
            });
        }

        await client.query('BEGIN');

        // Get next version_id
        const versionResult = await client.query(
            'SELECT COALESCE(max(version_id), 0) + 1 as new_version_id FROM permolat_track_versions'
        );
        const new_version_id = versionResult.rows[0].new_version_id;

        // Insert new version into permolat_track_versions
        const insertQuery = `
            INSERT INTO permolat_track_versions (
                geom, id, trackname, layer_name, importance, tracktype,
                currentcon, custodian,
                version_id, comments, added_by, 
                added_timestamp, moderated_timestamp
            )
            SELECT 
                ST_SetSRID(ST_GeomFromGeoJSON($1), 3857),
                $2,
                $3, $4, $5, $6, $7, $8,
                $9,
                $10,
                $11,
                NOW(),
                NOW()
            RETURNING version_id, id`;

        const result = await client.query(insertQuery, [
            JSON.stringify(req.body.geometry),
            props.id,  // Use the parent track id as the id
            props.trackname || null,
            props.layer_name || null,
            props.importance || null,
            props.tracktype || null,
            props.currentcon || null,
            props.custodian || null,
            new_version_id,  // version_id
            props.comments || 'Track edit via web interface',  // comments
            req.session.userid  // added_by (current user)
        ]);

        await client.query('COMMIT');
        
        res.status(201).json({ 
            success: true, 
            version_id: new_version_id,
            id: result.rows[0].id,
            message: 'Track version saved successfully, pending moderation'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving track version:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});
          
//ROLLBACKS AND ROLLFORWARDS MAY BE MODERATOR ONLY FUNCTIONS.
    
app.post('/api/rollback', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        // Validate input
        const props = req.body.properties;
        if (!props || !props.id || !props.prev_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required properties: id and prev_id' 
            });
        }

        await client.query('BEGIN');

        // Set the status flag on current parcel to old
        await client.query(
            'UPDATE permolat_tracks_prod SET status = $1 WHERE id = $2',
            ['old', props.id]
        );

        // Set the status flag on the previous parcel to live
        await client.query(
            'UPDATE permolat_tracks_prod SET status = $1 WHERE id = $2',
            ['live', props.prev_id]
        );

        await client.query('COMMIT');
        
        res.status(200).json({ 
            success: true, 
            message: 'Rollback successful'
        });
    } 
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Rollback error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});

//ROLL FORWARD

app.post('/api/rollforward', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        // Validate input
        const props = req.body.properties;
        if (!props || !props.id || !props.next_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required properties: id and next_id' 
            });
        }

        await client.query('BEGIN');

        // Set the flag on current parcel to old
        await client.query(
            'UPDATE permolat_tracks_prod SET status = $1 WHERE id = $2',
            ['old', props.id]
        );

        // Set the flag on the next parcel in the chain to live
        await client.query(
            'UPDATE permolat_tracks_prod SET status = $1 WHERE id = $2',
            ['live', props.next_id]
        );

        await client.query('COMMIT');
        
        res.status(200).json({ 
            success: true, 
            message: 'Roll forward successful'
        });
    } 
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Roll forward error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});

// Get track version history - for displaying git-like diff of track changes
app.get('/api/track-versions/:trackId', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const trackId = parseInt(req.params.trackId);
        
        console.log('Fetching track versions for trackId:', trackId);
        
        if (isNaN(trackId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid track ID' 
            });
        }

        // Get all versions for this track from permolat_track_versions
        // Exclude geometry for now as per user request
        const query = `
            SELECT 
                v.version_id,
                v.id,
                v.trackname,
                v.importance,
                v.tracktype,
                v.currentcon,
                v.custodian,
                v.lastcut,
                v.nextcut,
                v.comments,
                v.added_by,
                v.added_timestamp,
                v.reviewed_by,
                v.reviewed_timestamp,
                v.moderated_by,
                v.moderated_timestamp,
                u_added.username as added_by_username,
                u_reviewed.username as reviewed_by_username,
                u_moderated.username as moderated_by_username,
                CASE 
                    WHEN v.moderated_by IS NOT NULL THEN 'approved'
                    ELSE 'pending'
                END as status
            FROM permolat_track_versions v
            LEFT JOIN permomap_users u_added ON v.added_by = u_added.userid
            LEFT JOIN permomap_users u_reviewed ON v.reviewed_by = u_reviewed.userid
            LEFT JOIN permomap_users u_moderated ON v.moderated_by = u_moderated.userid
            WHERE v.id = $1
            ORDER BY v.version_id ASC`;

        console.log('Executing query with id:', trackId);
        const result = await client.query(query, [trackId]);
        console.log('Query returned', result.rows.length, 'rows');

        // It's OK if there are no versions yet - return empty array
        if (result.rows.length === 0) {
            return res.json({ 
                success: true,
                trackId: trackId,
                totalVersions: 0,
                versions: [],
                trackedFields: ['trackname', 'importance', 'tracktype', 'currentcon', 'custodian', 'lastcut', 'nextcut']
            });
        }

        // Compute diffs between consecutive versions
        const versions = result.rows;
        const trackedFields = ['trackname', 'importance', 'tracktype', 'currentcon', 'custodian', 'lastcut', 'nextcut'];
        
        const versionsWithDiffs = versions.map((version, index) => {
            const diffs = {};
            
            if (index > 0) {
                const prevVersion = versions[index - 1];
                
                trackedFields.forEach(field => {
                    const oldVal = prevVersion[field];
                    const newVal = version[field];
                    
                    // Normalize values for comparison
                    const oldNorm = oldVal === null || oldVal === undefined ? '' : String(oldVal);
                    const newNorm = newVal === null || newVal === undefined ? '' : String(newVal);
                    
                    if (oldNorm !== newNorm) {
                        diffs[field] = {
                            old: oldVal,
                            new: newVal,
                            changed: true
                        };
                    }
                });
            }
            
            return {
                ...version,
                diffs,
                isFirstVersion: index === 0
            };
        });

        res.json({ 
            success: true, 
            trackId: trackId,
            totalVersions: versions.length,
            versions: versionsWithDiffs,
            trackedFields: trackedFields
        });
        
    } catch (error) {
        console.error('Track versions error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Database error: ' + error.message 
        });
    } finally {
        client.release();
    }
});

// Moderate endpoint - for moderators to approve track versions for public visibility
app.post('/api/moderate', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        // Check if user has moderator role
        if (req.session.role !== 'moderator' && req.session.role !== 'sysadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Moderator access required' 
            });
        }

        const { version_id, action, comments } = req.body;
        
        // Validate input
        if (!version_id || !action) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: version_id and action' 
            });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Action must be either "approve" or "reject"' 
            });
        }

        await client.query('BEGIN');

        if (action === 'approve') {
            // Update the track version with moderation info
            await client.query(
                `UPDATE permolat_track_versions 
                 SET moderated_by = $1, 
                     moderated_timestamp = NOW(),
                     status = 'approved',
                     comments = COALESCE(comments, '') || $2
                 WHERE version_id = $3`,
                [
                    req.session.userid,
                    comments ? `\n[Moderator: ${comments}]` : '\n[Approved by moderator]',
                    version_id
                ]
            );

            // TODO: Additional logic to update the parent track or make version live
            // This depends on your specific workflow
            
        } else if (action === 'reject') {
            // Update the track version as rejected
            await client.query(
                `UPDATE permolat_track_versions 
                 SET moderated_by = $1, 
                     moderated_timestamp = NOW(),
                     status = 'rejected',
                     comments = COALESCE(comments, '') || $2
                 WHERE version_id = $3`,
                [
                    req.session.userid,
                    comments ? `\n[Moderator: ${comments}]` : '\n[Rejected by moderator]',
                    version_id
                ]
            );
        }

        await client.query('COMMIT');
        
        res.status(200).json({ 
            success: true, 
            message: `Track version ${action}d successfully`
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Moderation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});

// Peer review endpoint - for any user to review a track version
app.post('/api/review', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        const { version_id, comments } = req.body;
        
        // Validate input
        if (!version_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required field: version_id' 
            });
        }

        await client.query('BEGIN');

        // Check if user has already reviewed this version
        const existingReview = await client.query(
            'SELECT reviewed_by FROM permolat_track_versions WHERE version_id = $1',
            [version_id]
        );

        if (existingReview.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                message: 'Track version not found' 
            });
        }

        // Check if this version is their own edit
        const versionInfo = await client.query(
            'SELECT added_by FROM permolat_track_versions WHERE version_id = $1',
            [version_id]
        );

        if (versionInfo.rows[0].added_by === req.session.userid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot review your own track edits' 
            });
        }

        // Update with peer review info (single peer-review model)
        await client.query(
            `UPDATE permolat_track_versions 
             SET reviewed_by = $1, 
                 reviewed_timestamp = NOW(),
                 comments = COALESCE(comments, '') || $2
             WHERE version_id = $3`,
            [
                req.session.userid,
                comments ? `\n[Peer review by ${req.session.username}: ${comments}]` : `\n[Peer reviewed by ${req.session.username}]`,
                version_id
            ]
        );

        await client.query('COMMIT');
        
        res.status(200).json({ 
            success: true, 
            message: 'Track version reviewed successfully'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Review error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});

// Add comment to a track version
app.post('/api/version-comment', requireAuth, async(req, res) => {
    const client = await pool.connect();
    
    try {
        const { version_id, comment_text, parent_comment_id } = req.body;
        
        if (!version_id || !comment_text || comment_text.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Version ID and comment text are required' 
            });
        }

        await client.query('BEGIN');

        // Check if user is a moderator
        const userRole = req.session.role || 'public';
        const isModerator = userRole === 'moderator' || userRole === 'sysadmin';

        // Insert comment
        const insertResult = await client.query(
            `INSERT INTO permolat_version_comments 
                (version_id, user_id, comment_text, parent_comment_id, is_moderator_comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING comment_id, created_at`,
            [version_id, req.session.userid, comment_text, parent_comment_id || null, isModerator]
        );

        await client.query('COMMIT');
        
        res.status(201).json({ 
            success: true, 
            message: 'Comment added successfully',
            comment: {
                comment_id: insertResult.rows[0].comment_id,
                created_at: insertResult.rows[0].created_at,
                username: req.session.username
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Comment error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    } finally {
        client.release();
    }
});

// Get comments for a track version
app.get('/api/version-comments/:versionId', async(req, res) => {
    try {
        const { versionId } = req.params;
        
        const query = `
            SELECT 
                c.comment_id,
                c.version_id,
                c.user_id,
                c.comment_text,
                c.created_at,
                c.updated_at,
                c.parent_comment_id,
                c.is_moderator_comment,
                c.is_internal_note,
                u.username,
                u.email
            FROM permolat_version_comments c
            LEFT JOIN permomap_users u ON c.user_id = u.userid
            WHERE c.version_id = $1
            ORDER BY c.created_at ASC
        `;
        
        const result = await pool.query(query, [versionId]);
        
        res.status(200).json({ 
            success: true, 
            comments: result.rows
        });
        
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    }
});

// Contact version author - send notification/email
app.post('/api/contact-author', requireAuth, async(req, res) => {
    try {
        const { version_id, message } = req.body;
        
        if (!version_id || !message || message.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Version ID and message are required' 
            });
        }

        // Get author information
        const authorQuery = `
            SELECT 
                v.added_by,
                u.username,
                u.email
            FROM permolat_track_versions v
            LEFT JOIN permomap_users u ON v.added_by = u.userid
            WHERE v.version_id = $1
        `;
        
        const authorResult = await pool.query(authorQuery, [version_id]);
        
        if (authorResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Version not found' 
            });
        }
        
        const author = authorResult.rows[0];
        
        // For now, just create a comment as a way to contact
        // In a full implementation, you'd send an email here
        const commentResult = await pool.query(
            `INSERT INTO permolat_version_comments 
                (version_id, user_id, comment_text, parent_comment_id, is_moderator_comment)
             VALUES ($1, $2, $3, NULL, false)
             RETURNING comment_id`,
            [version_id, req.session.userid, `@${author.username} ${message}`]
        );
        
        // TODO: Send actual email notification to author.email
        // For now, we're using the comment system as a basic notification
        
        res.status(200).json({ 
            success: true, 
            message: 'Message sent as comment. Author will be notified.',
            author_username: author.username
        });
        
    } catch (error) {
        console.error('Contact author error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    }
});

// Get geometry for a specific version (for map overlay)
app.get('/api/version-geometry/:versionId', async(req, res) => {
    try {
        const { versionId } = req.params;
        
        const query = `
            SELECT 
                version_id,
                ST_AsGeoJSON(geom) as geometry
            FROM permolat_track_versions
            WHERE version_id = $1
        `;
        
        const result = await pool.query(query, [versionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Version not found' 
            });
        }
        
        const row = result.rows[0];
        
        res.status(200).json({ 
            success: true, 
            geometry: row.geometry ? JSON.parse(row.geometry) : null
        });
        
    } catch (error) {
        console.error('Get version geometry error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    }
});

// ─── Error Reporting ────────────────────────────────────────────────────────

const errorReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many error reports submitted, please try again later'
});

// POST /api/report-error  – submit an error report (requires login)
app.post('/api/report-error', errorReportLimiter, requireAuth, async (req, res) => {
    try {
        const {
            error_type,
            error_message,
            error_stack,
            user_description,
            page_url,
            viewport_width,
            viewport_height,
            screenshot_data,
            console_log_json
        } = req.body;

        // Reject oversized screenshots (max ~2 MB base64)
        if (screenshot_data && screenshot_data.length > 2 * 1024 * 1024) {
            return res.status(413).json({ ok: false, message: 'Screenshot data too large (max 2 MB)' });
        }

        // Only store relative path portion of URL to avoid leaking full origins
        let sanitizedUrl = null;
        if (page_url) {
            try {
                const u = new URL(page_url);
                sanitizedUrl = (u.pathname + u.search).substring(0, 500);
            } catch {
                sanitizedUrl = String(page_url).substring(0, 500);
            }
        }

        await pool.query(
            `INSERT INTO permomap_error_reports
                 (userid, username, error_type, error_message, error_stack,
                  user_description, page_url, user_agent,
                  viewport_width, viewport_height, screenshot_data, console_log_json)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
                req.session.userid || null,
                req.session.username || null,
                (error_type || 'user_report').substring(0, 50),
                error_message   ? String(error_message).substring(0, 2000)   : null,
                error_stack     ? String(error_stack).substring(0, 5000)     : null,
                user_description? String(user_description).substring(0, 2000): null,
                sanitizedUrl,
                req.get('User-Agent') ? req.get('User-Agent').substring(0, 500) : null,
                Number.isInteger(viewport_width)  ? viewport_width  : null,
                Number.isInteger(viewport_height) ? viewport_height : null,
                screenshot_data  || null,
                console_log_json ? String(console_log_json).substring(0, 10000) : null
            ]
        );

        res.status(201).json({ ok: true, message: 'Error report submitted. Thank you!' });
    } catch (error) {
        console.error('Error report submission failed:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// GET /api/admin/error-reports  – list unacknowledged reports (sysadmin only)
// Uses SELECT … FOR UPDATE SKIP LOCKED so concurrent admin sessions each get a
// distinct batch of rows to review without blocking each other.
app.get('/api/admin/error-reports', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.session.role !== 'sysadmin') {
            return res.status(403).json({ ok: false, message: 'System administrator access required' });
        }

        const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
        const offset = Math.max(parseInt(req.query.offset) || 0,  0);
        const includeAcknowledged = req.query.include_acknowledged === 'true';

        const whereClause = includeAcknowledged ? '' : 'WHERE acknowledged = FALSE';

        const result = await client.query(
            `SELECT id, userid, username, error_type, error_message, error_stack,
                    user_description, page_url, user_agent,
                    viewport_width, viewport_height, console_log_json,
                    acknowledged, acknowledged_at,
                    created_at,
                    CASE WHEN screenshot_data IS NOT NULL THEN true ELSE false END AS has_screenshot
             FROM permomap_error_reports
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2
             FOR UPDATE SKIP LOCKED`,
            [limit, offset]
        );

        res.status(200).json({ ok: true, reports: result.rows });
    } catch (error) {
        console.error('Get error reports error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/admin/error-reports/:id/screenshot  – fetch screenshot for one report
app.get('/api/admin/error-reports/:id/screenshot', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'sysadmin') {
            return res.status(403).json({ ok: false, message: 'System administrator access required' });
        }

        const reportId = parseInt(req.params.id);
        if (isNaN(reportId)) {
            return res.status(400).json({ ok: false, message: 'Invalid report ID' });
        }

        const result = await pool.query(
            'SELECT screenshot_data FROM permomap_error_reports WHERE id = $1',
            [reportId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ ok: false, message: 'Report not found' });
        }

        res.status(200).json({ ok: true, screenshot_data: result.rows[0].screenshot_data });
    } catch (error) {
        console.error('Get screenshot error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /api/admin/error-reports/:id/acknowledge  – mark a report reviewed
app.post('/api/admin/error-reports/:id/acknowledge', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'sysadmin') {
            return res.status(403).json({ ok: false, message: 'System administrator access required' });
        }

        const reportId = parseInt(req.params.id);
        if (isNaN(reportId)) {
            return res.status(400).json({ ok: false, message: 'Invalid report ID' });
        }

        const result = await pool.query(
            `UPDATE permomap_error_reports
             SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
             WHERE id = $2 RETURNING id`,
            [req.session.userid, reportId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ ok: false, message: 'Report not found' });
        }

        res.status(200).json({ ok: true, message: 'Report acknowledged' });
    } catch (error) {
        console.error('Acknowledge error report error:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// ─── End Error Reporting ─────────────────────────────────────────────────────

app.get('/api/total_length', async(req, res) => {
    try {
        const query = `
            SELECT 
                round(cast(sum(ST_Length(geom)/1000) as numeric)) || ' km of NZ tramping tracks and routes under community management' as length 
            FROM view_tracks 
            WHERE current_version = $1`;
        
        const result = await pool.query(query, [true]);
        
        res.status(200).json({ 
            success: true, 
            data: result.rows[0]
        });
    } 
    catch (err) {
        console.error('Total length query error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Database error' 
        });
    }
});


app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Registered routes:');
  console.log('  GET  /api/track-versions/:trackId');
  console.log('  POST /api/moderate');
  console.log('  POST /api/review');
  console.log('  POST /api/version-comment');
  console.log('  GET  /api/version-comments/:versionId');
  console.log('  POST /api/contact-author');
  console.log('  GET  /api/version-geometry/:versionId');
  console.log('  GET  /api/total_length');
});



app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
