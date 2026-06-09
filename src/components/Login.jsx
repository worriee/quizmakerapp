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
      // Note: App.jsx handles the session update via onAuthStateChange listener
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F2E9] p-4">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm max-w-md w-full border border-[#EAE7DC]">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#C5A059] mb-1 tracking-tight">TUON AI</h1>
          <p className="text-xs text-gray-400 mb-6 uppercase tracking-widest font-medium">To Understand On Navigation</p>
          <h2 className="text-xl font-bold text-gray-800">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        </div>

        {/* Auth Form */}
        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#C5A059] outline-none transition-all bg-gray-50/50"
              placeholder="youremail@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#C5A059] outline-none transition-all bg-gray-50/50"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Error Notification */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C5A059] text-white font-bold py-3 rounded-xl hover:bg-[#B8860B] transition-all shadow-lg disabled:bg-gray-300 active:scale-[0.98]"
          >
            {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsSignUp(!isSignUp);
              }}
              className="text-[#C5A059] font-bold hover:text-[#B8860B] transition-colors"
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
