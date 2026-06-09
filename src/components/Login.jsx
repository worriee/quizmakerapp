import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Login Component: Handles user authentication via Supabase (Email/Password).
 * Supports both Sign-In and Sign-Up modes.
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const formatAuthError = (message) => {
    const map = {
      'Invalid login credentials': 'Invalid email or password.',
      'Email not confirmed': 'Please confirm your email first.',
      'User already registered': 'An account with this email already exists.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters.',
      'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    };
    for (const [key, val] of Object.entries(map)) {
      if (message.includes(key)) return val;
    }
    return 'Something went wrong. Please try again.';
  };

  // Function to handle signing in existing users
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase Login Error:', error);
        throw error;
      }
    } catch (err) {
      setError(formatAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  // Function to handle creating new user accounts
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Supabase Sign Up Error:', error);
        throw error;
      }
      alert('Check your email for the confirmation link!');
    } catch (err) {
      setError(formatAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FCF6F5] p-4">
      <div className="bg-[#FCF6F5] p-8 rounded-2xl shadow-xl max-w-md w-full border border-[#7b9acc]/30">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-1">TUON AI</h1>
          <p className="text-sm text-[#7b9acc] mb-6 italic">To Understand Own Navigation</p>
          <h2 className="text-xl font-bold text-black">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        </div>

        {/* Auth Form */}
        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[#7b9acc]/30 focus:ring-2 focus:ring-[#7b9acc] outline-none transition-all"
              placeholder="youremail@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[#7b9acc]/30 focus:ring-2 focus:ring-[#7b9acc] outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Error Notification */}
          {error && (
            <div className="p-3 text-sm text-black bg-[#FCF6F5] border border-[#7b9acc]/30 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7b9acc] text-white font-semibold py-2 rounded-lg hover:bg-[#7b9acc] transition-colors shadow-md disabled:bg-[#7b9acc]/30"
          >
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 text-center">
          <p className="text-sm text-black">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsSignUp(!isSignUp);
              }}
              className="text-black font-semibold hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
