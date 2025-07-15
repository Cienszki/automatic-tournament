
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithRedirect, // Changed from signInWithPopup
  signOut as firebaseSignOut, 
  OAuthProvider, 
  type User,
  getRedirectResult, // Added to handle the result after redirect
} from "firebase/auth";
import { auth } from "@/lib/firebase"; 
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    // Check for redirect result on initial load
    getRedirectResult(auth)
      .catch((error) => {
        // Handle or log errors from the redirect.
        // This can happen if the user closes the window before signing in.
        console.error("Error getting redirect result:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
      
    return () => unsubscribe();
  }, []);

  const signInWithDiscord = async () => {
    const provider = new OAuthProvider("discord.com");
    // Start the redirect flow. The user will be sent to Discord and then back to your app.
    await signInWithRedirect(auth, provider);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const value = { user, isLoading, signInWithDiscord, signOut };
  
  if (isLoading) {
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
