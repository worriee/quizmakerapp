import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const VerifyEmail = () => {
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('No verification token provided.');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Verification failed');
        }

        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Something went wrong. Please try again.');
      }
    };

    verify();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-app p-4">
      <div className="bg-app-surface p-8 rounded-2xl shadow-xl max-w-md w-full border border-app text-center">
        <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-4">TUON AI</h1>

        {status === 'verifying' && (
          <div>
            <div className="animate-spin w-8 h-8 border-4 border-[#7b9acc] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-app-secondary">Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="w-16 h-16 bg-green-status rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-status" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-app mb-2">Email Verified!</h2>
            <p className="text-app-secondary mb-6">{message}</p>
            <a
              href="/"
              className="inline-block bg-[#7b9acc] text-white font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-colors"
            >
              Go to TUON AI
            </a>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="w-16 h-16 bg-red-status rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-status" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-app mb-2">Verification Failed</h2>
            <p className="text-app-secondary mb-6">{message}</p>
            <a
              href="/"
              className="inline-block bg-[#7b9acc] text-white font-semibold py-2 px-6 rounded-lg hover:opacity-90 transition-colors"
            >
              Back to TUON AI
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
