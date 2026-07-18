import { useState, useMemo } from "react";

const API_BASE_URL = "/api";

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "p@ssword",
  "p@ssw0rd",
  "pass123",
  "123456",
  "12345678",
  "123456789",
  "12345",
  "1234567",
  "1234567890",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "abc123",
  "abcdef",
  "abcdefg",
  "monkey",
  "dragon",
  "master",
  "login",
  "princess",
  "football",
  "shadow",
  "sunshine",
  "trustno1",
  "iloveyou",
  "batman",
  "access",
  "hello",
  "charlie",
  "donald",
  "admin",
  "welcome",
  "passw0rd",
  "letmein",
  "mustang",
  "michael",
  "ninja",
  "mustang1",
  "jesus",
  "changeme",
  "test",
  "guest",
  "hello123",
  "summer",
  "winter",
  "spring",
  "fall",
  "love",
  "secret",
  "solo",
]);

const getPasswordChecks = (pw) => [
  { label: "At least 8 characters", met: pw.length >= 8 },
  { label: "One uppercase letter", met: /[A-Z]/.test(pw) },
  { label: "One lowercase letter", met: /[a-z]/.test(pw) },
  { label: "One number", met: /[0-9]/.test(pw) },
  {
    label: "Not a common password",
    met: pw.length > 0 && !COMMON_PASSWORDS.has(pw.toLowerCase()),
  },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordValid = passwordChecks.every((c) => c.met);

  const formatAuthError = (message) => {
    const map = {
      "Invalid login credentials": "Invalid email or password.",
      "Email not confirmed": "Please confirm your email first.",
      "User already registered": "An account with this email already exists.",
      "Unable to validate email address: invalid format":
        "Please enter a valid email address.",
      "Account locked":
        "Account locked due to too many failed attempts. Please try again later.",
    };
    for (const [key, val] of Object.entries(map)) {
      if (message.includes(key)) return val;
    }
    if (message.startsWith("Password must have:")) return message;
    return "Something went wrong. Please try again.";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isSignUp ? "/auth/signup" : "/auth/login";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (isSignUp) {
        alert("Account created successfully! Please log in.");
        setIsSignUp(false);
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setError(formatAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-app p-4">
      <div className="bg-app-surface p-8 rounded-2xl shadow-xl max-w-md w-full border border-app">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[#7b9acc] mb-1">
            TUON AI
          </h1>
          <p className="text-sm text-[#7b9acc] mb-6 italic">
            To Understand Own Navigation
          </p>
          <h2 className="text-xl font-bold text-app">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-app mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-app bg-app-surface focus:ring-2 focus:ring-[#7b9acc] outline-none transition-all text-app"
              placeholder="••••••••"
              required
              minLength={8}
            />
            {!isSignUp && (
              <div className="text-right mt-1">
                <a
                  href="/forgot-password"
                  className="text-xs text-[#7b9acc] hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            )}
          </div>

          {/* Password Requirements (signup only) */}
          {isSignUp && password.length > 0 && (
            <div className="space-y-1">
              {passwordChecks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className={
                      check.met ? "text-green-status" : "text-app-muted"
                    }
                  >
                    {check.met ? "✓" : "○"}
                  </span>
                  <span
                    className={
                      check.met ? "text-green-status" : "text-app-secondary"
                    }
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="p-3 text-sm text-app bg-app-surface border border-app rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (isSignUp && !passwordValid)}
            className="w-full bg-[#7b9acc] text-white font-semibold py-2 rounded-lg hover:bg-[#7b9acc] transition-colors shadow-md disabled:bg-[#7b9acc]/30"
          >
            {loading
              ? isSignUp
                ? "Creating account..."
                : "Signing in..."
              : isSignUp
                ? "Sign Up"
                : "Sign In"}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-6 text-center">
          <p className="text-sm text-app">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-app font-semibold hover:underline"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
