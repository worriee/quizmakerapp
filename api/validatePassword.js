/**
 * validatePassword.js — Password strength validation for SEC-010.
 * Enforces minimum 8 chars, uppercase, lowercase, number, and blocks common passwords.
 */

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
  "nassword",
  "password!",
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
  "asakaboi",
]);

/**
 * validatePassword: Checks password against all security requirements.
 * Returns all failing rules so the frontend can display them.
 * @param {string} password - The password to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Password is required"] };
  }

  if (password.length < 8) {
    errors.push("At least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("One uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("One lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("One number");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Too common — choose a more unique password");
  }

  return { valid: errors.length === 0, errors };
}
