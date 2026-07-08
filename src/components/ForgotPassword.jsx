import { useState } from "react";

const API_BASE_URL = "/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-app p-4">
      <div className="bg-app-surface p-8 rounded-2xl shadow-xl max-w-md w-full border border-app">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-1">
            TUON AI
          </h1>
          <h2 className="text-xl font-bold text-app">Reset Password</h2>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-status rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-status"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-app-secondary mb-2">
              If an account exists with this email, a reset link has been sent.
            </p>
            <p className="text-sm text-app-muted">
              Check your inbox and follow the link to reset your password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-app-secondary">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            <div>
              <label className="block text-sm font-medium text-app mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-app bg-app-surface focus:ring-2 focus:ring-[#7b9acc] outline-none transition-all text-app"
                placeholder="youremail@example.com"
                required
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-app bg-app-surface border border-app rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7b9acc] text-white font-semibold py-2 rounded-lg hover:bg-[#7b9acc] transition-colors shadow-md disabled:bg-[#7b9acc]/30"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-app-secondary hover:underline">
            Back to TUON AI
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
