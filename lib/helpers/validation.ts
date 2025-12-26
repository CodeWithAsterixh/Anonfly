export const validateUsername = (username: string): boolean => {
  return username.length >= 3 && /^[a-zA-Z0-9]+$/.test(username);
};

export const validateEmail = (email: string): boolean => {
  // Basic email validation regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Password must be at least 6 characters long, contain at least one uppercase letter, one lowercase letter, and one number.
  return password.length >= 6 &&
         /[A-Z]/.test(password) &&
         /[a-z]/.test(password) &&
         /[0-9]/.test(password);
};
