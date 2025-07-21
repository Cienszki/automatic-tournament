
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signOut as firebaseSignOut, 
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase"; 
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserTeam as fetchUserTeam } from "@/lib/admin-actions";

interface UserTeamInfo {
    hasTeam: boolean;
    teamId: string | null;
    teamName: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userTeamInfo: UserTeamInfo;
  refreshUserTeam: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userTeamInfo, setUserTeamInfo] = useState<UserTeamInfo>({ hasTeam: false, teamId: null, teamName: null });
  const { toast } = useToast();
  
  const refreshUserTeam = useCallback(async () => {
    if (auth.currentUser) {
      const teamData = await fetchUserTeam(auth.currentUser.uid);
      setUserTeamInfo({
        hasTeam: teamData.hasTeam,
        teamId: teamData.team?.id || null,
        teamName: teamData.team?.name || null,
      });
    } else {
      setUserTeamInfo({ hasTeam: false, teamId: null, teamName: null });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await refreshUserTeam();
      } else {
        setUserTeamInfo({ hasTeam: false, teamId: null, teamName: null });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [refreshUserTeam]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({
        title: "Signed In",
        description: "You have successfully signed in.",
      });
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({
        title: "Sign-in Error",
        description: "Could not sign in with Google. Please try again.",
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, userTeamInfo, refreshUserTeam, signInWithGoogle, signOut }}>
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
