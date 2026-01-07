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
            // Update OAuth provider if not set
            if (!user.rows[0].oauth_provider) {
                await pool.query(
                    'UPDATE permomap_users SET oauth_provider = $1, oauth_id = $2 WHERE userid = $3',
                    [provider, profile.id, user.rows[0].userid]
                );
            }
            return user.rows[0];
        }

        // Create new user
        const result = await pool.query(
            `INSERT INTO permomap_users (username, email, role, oauth_provider, oauth_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING userid, username, email, role`,
            [displayName, email, 'user', provider, profile.id]
        );
        
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
        res.redirect(`${BASE_PATH}/?oauth=success`);
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
        res.redirect(`${BASE_PATH}/?oauth=success`);
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
        res.redirect(`${BASE_PATH}/?oauth=success`);
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
    res.status(401).json({ ok: false, message: 'Not authenticated' });
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
        if (req.session.role !== 'admin') {
            return res.status(403).json({ ok: false, message: 'Admin access required' });
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
        if (req.session.role !== 'admin') {
            return res.status(403).json({ ok: false, message: 'Admin access required' });
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
// Main saving logic
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

        await client.query('BEGIN');

        // Get next ID
        const result1 = await client.query(
            'SELECT COALESCE(max(id), 0) + 1 as new_id FROM permolat_tracks'
        );
        const new_id = result1.rows[0].new_id;

        // Insert new track with parameterized query
        const insertQuery = `
            INSERT INTO permolat_tracks (
                geom, id, trackname, layer_name, importance, tracktype,
                currentcon, custodian, next_id, prev_id, history, status
            )
            SELECT 
                ST_SetSRID(ST_GeomFromGeoJSON($1), 3857),
                $2,
                $3, $4, $5, $6, $7, $8,
                NULL,
                $9,
                $10,
                'pending'
            RETURNING id`;

        const props = req.body.properties;
        const result = await client.query(insertQuery, [
            JSON.stringify(req.body.geometry),
            new_id,
            props.trackname || null,
            props.layer_name || null,
            props.importance || null,
            props.tracktype || null,
            props.currentcon || null,
            props.custodian || null,
            props.id ? parseInt(props.id) : null,
            props.history || ''
        ]);

        await client.query('COMMIT');
        
        res.status(201).json({ 
            success: true, 
            id: new_id,
            message: 'Track saved successfully, pending moderation'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving track:', error);
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
            'UPDATE permolat_tracks SET status = $1 WHERE id = $2',
            ['old', props.id]
        );

        // Set the status flag on the previous parcel to live
        await client.query(
            'UPDATE permolat_tracks SET status = $1 WHERE id = $2',
            ['live', props.prev_id]
        );

        // Record history
        const now = new Date();
        const historyEntry = `\n${req.session.username || 'User'} rolled back to this version on ${now.toISOString()}`;
        
        await client.query(
            'UPDATE permolat_tracks SET history = COALESCE(history, \'\') || $1 WHERE id = $2',
            [historyEntry, props.prev_id]
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
            'UPDATE permolat_tracks SET status = $1 WHERE id = $2',
            ['old', props.id]
        );

        // Set the flag on the next parcel in the chain to live
        await client.query(
            'UPDATE permolat_tracks SET status = $1 WHERE id = $2',
            ['live', props.next_id]
        );

        // Record history
        const now = new Date();
        const historyEntry = `\n${req.session.username || 'User'} rolled forward to this version on ${now.toISOString()}`;
        
        await client.query(
            'UPDATE permolat_tracks SET history = COALESCE(history, \'\') || $1 WHERE id = $2',
            [historyEntry, props.next_id]
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
});



app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
