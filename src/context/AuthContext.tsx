
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, // Changed from signInWithRedirect
  signOut as firebaseSignOut, 
  GoogleAuthProvider,
  type User,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        const idToken = await result.user.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        toast({
          title: "Signed In",
          description: "You have successfully signed in with Google.",
        });
      }
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
       if (error.code !== 'auth/popup-closed-by-user') {
          toast({
            title: "Sign-in Error",
            description: "Could not sign in with Google. Please try again.",
            variant: "destructive",
          });
       }
    } finally {
        // The onAuthStateChanged listener will handle setting loading to false
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      await fetch('/api/auth/session', {
        method: 'DELETE',
      });
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Sign-out Error",
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      // onAuthStateChanged will set the user to null and loading to false
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {loading ? (
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-16 w-16 animate-spin" />
        </div>
      ) : (
        children
      )}
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
