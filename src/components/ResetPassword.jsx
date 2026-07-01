import { useState, useMemo } from 'react';

const API_BASE_URL = '/api';

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'p@ssword', 'p@ssw0rd', 'pass123',
  '123456', '12345678', '123456789', '12345', '1234567', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', 'abcdef', 'abcdefg',
  'monkey', 'dragon', 'master', 'login', 'princess', 'football',
  'shadow', 'sunshine', 'trustno1', 'iloveyou', 'batman', 'access',
  'hello', 'charlie', 'donald', 'admin', 'welcome', 'passw0rd',
  'letmein', 'mustang', 'michael', 'ninja', 'mustang1', 'jesus',
  'changeme', 'test', 'guest', 'hello123',
  'summer', 'winter', 'spring', 'fall', 'love', 'secret', 'solo',
]);

const getPasswordChecks = (pw) => [
  { label: 'At least 8 characters', met: pw.length >= 8 },
  { label: 'One uppercase letter', met: /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', met: /[a-z]/.test(pw) },
  { label: 'One number', met: /[0-9]/.test(pw) },
  { label: 'Not a common password', met: pw.length > 0 && !COMMON_PASSWORDS.has(pw.toLowerCase()) },
];

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('form'); // form | success | error
  const [message, setMessage] = useState('');

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordValid = passwordChecks.every((c) => c.met);

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordValid) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setStatus('success');
      setMessage(data.message || 'Password reset successfully!');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FCF6F5] p-4">
        <div className="bg-[#FCF6F5] p-8 rounded-2xl shadow-xl max-w-md w-full border border-[#7b9acc]/30 text-center">
          <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-4">TUON AI</h1>
          <h2 className="text-xl font-bold text-black mb-2">Invalid Link</h2>
          <p className="text-black/60 mb-6">No reset token provided. Please request a new password reset link.</p>
          <a
            href="/forgot-password"
            className="inline-block bg-[#7b9acc] text-white font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-colors"
          >
            Request New Link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FCF6F5] p-4">
      <div className="bg-[#FCF6F5] p-8 rounded-2xl shadow-xl max-w-md w-full border border-[#7b9acc]/30">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-1">TUON AI</h1>
          <h2 className="text-xl font-bold text-black">Set New Password</h2>
        </div>

        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-black/60 mb-6">{message}</p>
            <a
              href="/"
              className="inline-block bg-[#7b9acc] text-white font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-colors"
            >
              Go to Login
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Reset Failed</h2>
            <p className="text-black/60 mb-6">{message}</p>
            <a
              href="/forgot-password"
              className="inline-block bg-[#7b9acc] text-white font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-colors"
            >
              Try Again
            </a>
          </div>
        )}

        {status === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-[#7b9acc]/30 focus:ring-2 focus:ring-[#7b9acc] outline-none transition-all"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {password.length > 0 && (
              <div className="space-y-1">
                {passwordChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2 text-[11px]">
                    <span className={check.met ? 'text-green-500' : 'text-black/30'}>
                      {check.met ? '✓' : '○'}
                    </span>
                    <span className={check.met ? 'text-green-600' : 'text-black/40'}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordValid}
              className="w-full bg-[#7b9acc] text-white font-semibold py-2 rounded-lg hover:bg-[#7b9acc] transition-colors shadow-md disabled:bg-[#7b9acc]/30"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
