import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import { validatePassword } from './validatePassword.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendLockoutEmail } from './email.js';

const router = express.Router();
router.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRY = '1d';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * checkAccountLock: Checks if an account is currently locked due to failed login attempts.
 * @param {Object} user - The user record from the database.
 * @returns {{ locked: boolean, message: string }}
 */
function checkAccountLock(user) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return { locked: true, message: `Account locked due to too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.` };
  }
  return { locked: false };
}

/**
 * recordFailedLogin: Increments failed login attempts. Locks account after MAX_FAILED_ATTEMPTS.
 * @param {string} email - The user's email address.
 */
async function recordFailedLogin(email) {
  try {
    const { data: user } = await supabaseService
      .from('profiles')
      .select('failed_login_attempts')
      .eq('email', email)
      .single();

    const attempts = (user?.failed_login_attempts || 0) + 1;
    const updates = { failed_login_attempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      // Send lockout notification email (fire-and-forget)
      sendLockoutEmail(email, updates.locked_until).catch(() => {});
    }

    await supabaseService
      .from('profiles')
      .update(updates)
      .eq('email', email);
  } catch (err) {
    console.error('[Auth] Failed to record login attempt:', err.message || err);
  }
}

/**
 * resetFailedLogins: Clears failed attempts and lockout on successful login.
 * @param {string} email - The user's email address.
 */
async function resetFailedLogins(email) {
  try {
    await supabaseService
      .from('profiles')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('email', email);
  } catch (err) {
    console.error('[Auth] Failed to reset login attempts:', err.message || err);
  }
}

// Server-side Supabase client using service_role key to bypass RLS
const supabaseService = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const authenticate = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: `Password must have: ${passwordCheck.errors.join(', ')}` });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseService
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // SEC-003: Generate verification token
    const verificationToken = generateToken();

    // Create user in profiles table
    const { data: newUser, error: insertError } = await supabaseService
      .from('profiles')
      .insert([
        {
          email,
          password_hash: passwordHash,
          email_verified: false,
          verification_token: verificationToken,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError.message || insertError);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    // SEC-003: Send verification email (fire-and-forget)
    sendVerificationEmail(email, verificationToken).catch(() => {});

    // Sign JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });
    
    res.status(201).json({ user: { id: newUser.id, email: newUser.email } });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Find user
    const { data: user, error: fetchError } = await supabaseService
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // SEC-009: Check if account is locked
    const lockStatus = checkAccountLock(user);
    if (lockStatus.locked) {
      return res.status(429).json({ error: lockStatus.message });
    }

    // Guard: existing users migrated from Supabase Auth may lack password_hash
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account was created before the system update. Please contact support or reset your password.' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await recordFailedLogin(email);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // SEC-009: Reset failed attempts on successful login
    await resetFailedLogins(email);

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, emailVerified: user.email_verified || false },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
    });
    
    res.json({ user: { id: user.id, email: user.email } });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: user, error: fetchError } = await supabaseService
      .from('profiles')
      .select('id, email, email_verified')
      .eq('id', req.user.id)
      .single();

    if (fetchError || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/**
 * generateToken: Creates a cryptographically secure random token for email verification or password reset.
 * @returns {string} A 64-character hex string.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const { data: user, error: fetchError } = await supabaseService
      .from('profiles')
      .select('id, verification_token')
      .eq('verification_token', token)
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const { error: updateError } = await supabaseService
      .from('profiles')
      .update({
        email_verified: true,
        verification_token: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Auth] Failed to verify email:', updateError.message || updateError);
      return res.status(500).json({ error: 'Failed to verify email' });
    }

    res.json({ message: 'Email verified successfully' });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !EMAIL_REGEX.test(email)) {
      // Return success even if email not found (prevent email enumeration)
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    const { data: user } = await supabaseService
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      // Return success even if user not found (prevent email enumeration)
      return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await supabaseService
      .from('profiles')
      .update({
        reset_token: resetToken,
        reset_token_expires: expiresAt,
      })
      .eq('id', user.id);

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: `Password must have: ${passwordCheck.errors.join(', ')}` });
    }

    const { data: user, error: fetchError } = await supabaseService
      .from('profiles')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { error: updateError } = await supabaseService
      .from('profiles')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Auth] Failed to reset password:', updateError.message || updateError);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export { router as authRouter, supabaseService, authenticate };
