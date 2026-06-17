import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const API_URL = 'https://statsathi-backend.onrender.com';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user details
  const fetchProfile = async (currentToken) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setError(null);
      } else {
        // Token invalid or expired
        logout();
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      // Don't log out on temporary network issues, but stop loading
    } finally {
      setLoading(false);
    }
  };

  // Run on startup to load user if token exists
  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  // Login handler
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to login. Please check your credentials.');
      }

      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      await fetchProfile(data.access_token);
      return true;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  // Sign up handler
  const signup = async (fullName, institution, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          institution: institution,
          email: email,
          password: password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle array validation errors if any or direct string details
        const errorMsg = Array.isArray(data.detail)
          ? data.detail[0]?.msg
          : data.detail || 'Registration failed.';
        throw new Error(errorMsg);
      }

      // Auto login after successful signup
      return await login(email, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setError(null);
    setLoading(false);
  };

  // Update profile handler
  const updateProfile = async (fullName, institution, occupation) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName,
          institution: institution,
          occupation: occupation
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = Array.isArray(data.detail)
          ? data.detail[0]?.msg
          : data.detail || 'Failed to update profile.';
        throw new Error(errorMsg);
      }

      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, signup, logout, updateProfile, setError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
