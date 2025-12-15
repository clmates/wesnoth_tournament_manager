import { Router } from 'express';
import { query } from '../config/database.js';
import { hashPassword, comparePasswords, generateToken, validatePassword } from '../utils/auth.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Register request
router.post('/register', async (req, res) => {
  try {
    const { nickname, email, language, discord_id, password } = req.body;

    console.log('Register request:', { nickname, email, language, password: '***', discord_id });

    // Validate required fields
    if (!nickname || !email || !password) {
      console.log('Missing required fields:', { nickname: !!nickname, email: !!email, password: !!password });
      return res.status(400).json({ error: 'Nickname, email, and password are required' });
    }

    // Validate password
    const validation = await validatePassword(password);
    if (!validation.valid) {
      console.log('Password validation failed:', validation.errors);
      return res.status(400).json({ errors: validation.errors });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE nickname = $1 OR email = $2', [nickname, email]);
    if (existing.rows.length > 0) {
      console.log('User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user directly (blocked by default - admin must activate)
    const result = await query(
      `INSERT INTO users (nickname, email, password_hash, language, discord_id, is_active, is_admin, is_blocked, is_rated, matches_played, elo_provisional, total_wins, total_losses, trend)
       VALUES ($1, $2, $3, $4, $5, true, false, true, false, 0, false, 0, 0, '-')
       RETURNING id`,
      [nickname, email, passwordHash, language || 'en', discord_id || null]
    );

    console.log('User created successfully:', result.rows[0].id);
    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: (error as any).message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;

    const result = await query('SELECT id, password_hash, is_blocked FROM users WHERE nickname = $1', [nickname]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    const isValid = await comparePasswords(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.json({ token, userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePasswords(oldPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const validation = await validatePassword(newPassword, req.userId);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const newHash = await hashPassword(newPassword);

    // Save old password to history
    await query(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [req.userId, userResult.rows[0].password_hash]
    );

    // Update password
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
