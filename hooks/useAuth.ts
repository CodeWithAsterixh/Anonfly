/**
 * @file useAuth.ts
 * @description Custom hook for authentication logic, including login, registration, and token management.
 */

import { useState, useEffect, useCallback } from 'react';
import { login, createUser, getUser } from '../lib/controllers/authController';
import type { User } from '../types/User';
import Cookies from 'js-cookie';



interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginUser: (username: string, password: string) => Promise<void>;
  registerUser: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing authentication state and actions.
 * Provides functions for logging in, registering, and logging out users.
 * Manages authentication token storage in localStorage.
 * 
 * @returns {
 *   user: User | null,
 *   token: string | null,
 *   isAuthenticated: boolean,
 *   loading: boolean,
 *   error: string | null,
 *   loginUser: (username: string, password: string) => Promise<void>,
 *   registerUser: (username: string, password: string) => Promise<void>,
 *   logout: () => void
 * }
 */
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    /**
     * Initializes authentication state from localStorage on component mount.
     */
    const initializeAuth = async () => {
      const storedToken = Cookies.get('token');

      if (storedToken) {
        try {
          const userData = await getUser(storedToken);
          setAuthState({
            user: userData.data,
            token: storedToken,
            isAuthenticated: true,
            loading: false,
            error: null,
          });
        } catch (error: any) {
          console.error("Failed to fetch user data on initialization:", error);
          // Only clear token if it's an unauthorized error (e.g., 401 invalid token)
          if (error.response && error.response.status === 401) {
            Cookies.remove('token'); // Clear invalid token
            setAuthState(prev => ({ ...prev, loading: false, isAuthenticated: false, token: null, user: null, error: 'Session expired. Please log in again.' }));
          } else {
            // For other errors, just set loading to false and keep existing token (if any)
            setAuthState(prev => ({ ...prev, loading: false, error: error.message || 'An unexpected error occurred.' }));
          }
        }
      } else {
        setAuthState(prev => ({ ...prev, loading: false, isAuthenticated: false }));
      }
    };

    initializeAuth();
  }, []);

  /**
   * Handles user login.
   * @param {string} username - The username for login.
   * @param {string} password - The password for login.
   * @returns {Promise<void>}
   */
  const loginUser = useCallback(async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await login({
        username, password
      });
      if (response.data.token && response.data.user) {
        Cookies.set('token', response.data.token, { expires: 7 }); // Token expires in 7 days
        setAuthState({
          user: response.data.user,
          token: response.data.token,
          isAuthenticated: true,
          loading: false,
          error: null,
        });
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (err: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: err.message || 'An unknown error occurred during login',
      }));
    }
  }, []);

  /**
   * Handles user registration.
   * @param {string} username - The username for registration.
   * @param {string} password - The password for registration.
   * @returns {Promise<void>}
   */
  const registerUser = useCallback(async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await createUser({username, password});
      if (response.token && response.user) {
        Cookies.set('token', response.token, { expires: 7 }); // Token expires in 7 days
        setAuthState({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          loading: false,
          error: null,
        });
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (err: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: err.message || 'An unknown error occurred during registration',
      }));
    }
  }, []);

  /**
   * Logs out the current user by removing token and user data from localStorage.
   */
  const logout = useCallback(() => {
    Cookies.remove('token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  }, []);

  return {
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    error: authState.error,
    loginUser,
    registerUser,
    logout,
  };
};
