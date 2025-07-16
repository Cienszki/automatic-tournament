
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signOut as firebaseSignOut, 
  OAuthProvider, 
  type User,
  getAuth,
} from "firebase/auth";
import { app } from "@/lib/firebase"; 
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const auth = getAuth(app);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const signInWithDiscord = async () => {
    const provider = new OAuthProvider("oidc.discord");
    provider.addScope('identify');
    provider.addScope('email');

    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      toast({ title: "Signed In", description: `Welcome, ${result.user.displayName}!` });
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase Auth Error:", error);
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast({
          variant: "destructive",
          title: "Account Exists",
          description: "This email is linked to another sign-in method. Please use that provider to sign in.",
          duration: 9000,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "Could not complete sign-in. Please try again.",
          duration: 9000,
        });
      }
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast({ title: "Signed Out" });
    } catch (error) {
      console.error("Sign Out Error:", error);
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
