import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { ref, set, get, update, serverTimestamp } from "firebase/database";
import { auth, db } from "@/lib/firebase";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AuthCtx = {
  user: User | null;
  session: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

function friendlyError(code: string) {
  const map: Record<string, string> = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

async function saveUser(user: User, displayName?: string) {
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);
  if (snap.exists()) {
    // Only update mutable fields — never overwrite publicKey or display_name set by user
    await update(userRef, { email: user.email, lastLogin: serverTimestamp() });
  } else {
    await set(userRef, {
      email: user.email,
      uid: user.uid,
      display_name: displayName ?? user.email?.split("@")[0] ?? "Listener",
      lastLogin: serverTimestamp(),
    });
  }
}

async function loadProfileFromDB(uid: string): Promise<Profile | null> {
  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) return null;
  const data = snap.val();
  return { id: uid, display_name: data.display_name ?? "Listener", avatar_url: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await loadProfileFromDB(u.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
      await saveUser(u, displayName);
      return { error: null };
    } catch (err: any) {
      return { error: friendlyError(err.code) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user: u } = await signInWithEmailAndPassword(auth, email, password);
      await saveUser(u);
      return { error: null };
    } catch (err: any) {
      return { error: friendlyError(err.code) };
    }
  };

  const signOut = async () => { await fbSignOut(auth); };

  const refreshProfile = async () => {
    if (user) setProfile(await loadProfileFromDB(user.uid));
  };

  const updateDisplayName = async (newName: string): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not logged in" };
    try {
      await update(ref(db, `users/${user.uid}`), { display_name: newName.trim() });
      setProfile((p) => p ? { ...p, display_name: newName.trim() } : p);
      return { error: null };
    } catch (err: any) {
      return { error: err.message ?? "Failed to update name" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session: user, profile, loading, signUp, signIn, signOut, refreshProfile, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
