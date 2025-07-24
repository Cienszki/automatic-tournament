
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithRedirect,
  signOut as firebaseSignOut, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
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
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // This function will handle all auth state changes,
    // including the result from a redirect.
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Check for redirect result specifically on component mount
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          // If we get a result, a sign-in just happened.
          // onAuthStateChanged will handle setting the user,
          // but we still need to create our server session.
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
      })
      .catch((error) => {
        // Handle potential errors from the redirect, e.g., user cancels
        console.error("Redirect result error:", error.message);
        if (error.code !== 'auth/cancelled-popup-request') {
            toast({
                title: "Sign-in Error",
                description: "Could not complete sign-in with Google.",
                variant: "destructive",
            });
        }
      })
      .finally(() => {
        // Even if there's no redirect result, we might still be loading
        // the initial user state from the onAuthStateChanged listener.
        // The listener itself will set loading to false.
      });

    return () => unsubscribe();
  }, [toast]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true); // Set loading to true before redirecting
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast({
        title: "Sign-in Error",
        description: "Could not sign in with Google. Please try again.",
        variant: "destructive",
      });
      setLoading(false); // Reset loading on error
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const idToken = await userCredential.user.getIdToken();
        await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        toast({
            title: "Signed In",
            description: "You have successfully signed in.",
        });
    } catch (error: any) {
        console.error("Error signing in with email:", error);
        toast({
            title: "Sign-in Error",
            description: error.message || "Could not sign in. Please check your credentials.",
            variant: "destructive",
        });
    } finally {
        setLoading(false);
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signOut }}>
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
