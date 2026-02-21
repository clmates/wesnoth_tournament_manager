import { Router } from 'express';
import { generateTokenWithUsername, verifyToken } from '../utils/auth.js';
import { authenticatePhpbbUser, getPhpbbUser } from '../services/phpbbAuth.js';
import { generateUUID } from '../utils/uuid.js';
import { queryTournament } from '../config/tournamentDatabase.js';

const router = Router();

// Login - RATE LIMITED with phpBB database authentication
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Normalize username to lowercase for case-insensitive comparison
    const normalizedUsername = username.toLowerCase();

    console.log(`🔐 [LOGIN] Attempting login for user: ${normalizedUsername}`);

    // Authenticate user against phpBB database
    const authResult = await authenticatePhpbbUser(normalizedUsername, password);
    
    if (!authResult.valid) {
      console.log(`❌ [LOGIN] Failed login for ${normalizedUsername}: ${authResult.error}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`✅ [LOGIN] Successfully authenticated ${normalizedUsername}`);

    // Check if user exists in users_extension (tournament database)
    const existingUsers = await queryTournament(
      'SELECT id FROM users_extension WHERE LOWER(nickname) = LOWER(?)',
      [normalizedUsername]
    ) as any[];

    let tournamentUserId: string;

    if (!existingUsers || existingUsers.length === 0) {
      // Create new user in users_extension table
      console.log(`🔐 [LOGIN] Creating new user in users_extension: ${normalizedUsername}`);
      tournamentUserId = generateUUID();
      
      await queryTournament(
        `INSERT INTO users_extension (id, nickname, email, is_active, is_blocked, locked_until)
         VALUES (?, ?, ?, 1, 0, NULL)`,
        [tournamentUserId, normalizedUsername, authResult.email]
      );
      
      console.log(`✅ [LOGIN] User created in users_extension: ${tournamentUserId}`);
    } else {
      tournamentUserId = existingUsers[0].id;
      console.log(`✅ [LOGIN] User already exists in users_extension: ${tournamentUserId}`);
    }

    // Generate JWT token with tournament database user ID
    const token = generateTokenWithUsername(normalizedUsername, tournamentUserId);

    res.json({ 
      token, 
      username: normalizedUsername,
      userId: tournamentUserId,
      email: authResult.email
    });

  } catch (error) {
    console.error(`❌ [LOGIN] Error:`, error);
    res.status(500).json({ error: 'Login failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Validate token endpoint - used by frontend on app load
router.get('/validate-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log(`🔐 [VALIDATE] Token validation requested`);

    // Verify JWT token
    const decoded = verifyToken(token);
    console.log(`✅ [VALIDATE] Token verified for user: ${decoded.username}`);

    // Get full user info from phpBB
    const phpbbUser = await getPhpbbUser(decoded.username);
    if (!phpbbUser) {
      console.warn(`⚠️  [VALIDATE] User no longer exists in phpBB: ${decoded.username}`);
      return res.status(401).json({ error: 'User not found' });
    }

    // Return user info
    res.json({
      valid: true,
      userId: phpbbUser.user_id,
      username: phpbbUser.username,
      email: phpbbUser.user_email,
      isAdmin: false // TODO: Check if user is admin/organizer
    });

  } catch (error) {
    console.error('❌ [VALIDATE] Token validation error:', error);
    res.status(401).json({ error: 'Token validation failed' });
  }
});

export default router;
