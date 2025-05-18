"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AuthContextType {
  token: string | null;
  userId: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (newToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to parse JWT. In a real app, consider a more robust library if complex claims are needed.
const parseJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true until token is checked
  const [isInitialized, setIsInitialized] = useState(false); // Add state for isInitialized

  useEffect(() => {
    // Try to load token from localStorage on initial mount
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      const decodedToken = parseJwt(storedToken);
      if (decodedToken && decodedToken.exp * 1000 > Date.now()) {
        setToken(storedToken);
        setUserId(decodedToken.userId || null);
        setUsername(decodedToken.username || null);
      } else {
        localStorage.removeItem("authToken"); // Token expired or invalid
        setToken(null);
        setUserId(null);
        setUsername(null);
      }
    } else {
      // This is a normal expected state for first-time visitors, removing error message
      setToken(null);
      setUserId(null);
      setUsername(null);
    }
    setIsLoading(false);
    setIsInitialized(true); // Set isInitialized to true after attempting to load token
  }, []);

  const login = (newToken: string) => {
    const decodedToken = parseJwt(newToken);
    if (decodedToken) {
      localStorage.setItem("authToken", newToken);
      setToken(newToken);
      setUserId(decodedToken.userId || null);
      setUsername(decodedToken.username || null);
    } else {
      console.error("Failed to parse token on login");
      // Potentially handle this error more gracefully
    }
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setUserId(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        username,
        isAuthenticated: !!token,
        isLoading,
        isInitialized,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
