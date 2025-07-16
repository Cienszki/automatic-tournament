
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut, 
  OAuthProvider, 
  type User,
  getAuth,
} from "firebase/auth";
import { app } from "@/lib/firebase"; 
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const auth = getAuth(app);

  useEffect(() => {
    setIsMounted(true);
    
    getRedirectResult(auth)
      .catch((error) => {
        console.error("Error getting redirect result:", error);
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
      
    return () => unsubscribe();
  }, [auth]);

  const signInWithDiscord = async () => {
    const provider = new OAuthProvider("oidc.discord");
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Error signing in with Discord:", error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = { user, isLoading, signInWithDiscord, signOut };
  
  if (isLoading || !isMounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
