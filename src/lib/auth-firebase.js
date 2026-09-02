// auth.js — Firebase Authentication (Email/Password)
// Handles login, signup, logout and stores user data in Realtime Database

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, set, serverTimestamp } from "firebase/database";
import { auth, db } from "./firebase.js";

/**
 * Save/update user record in /users/{uid} on every login or signup.
 */
async function saveUser(user) {
  await set(ref(db, `users/${user.uid}`), {
    email: user.email,
    uid: user.uid,
    lastLogin: serverTimestamp(),
  });
}

/**
 * Sign up a new user with email + password.
 * Stores user data in DB and redirects to dashboard on success.
 * @returns {{ error: string|null }}
 */
export async function signUp(email, password) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await saveUser(user);
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
}

/**
 * Sign in an existing user with email + password.
 * Stores last login timestamp and redirects to dashboard.
 * @returns {{ error: string|null }}
 */
export async function signIn(email, password) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await saveUser(user);
    return { error: null };
  } catch (err) {
    return { error: friendlyError(err.code) };
  }
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  await fbSignOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Calls callback(user) when auth state changes — user is null when signed out.
 * @param {(user: import("firebase/auth").User|null) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Returns the currently signed-in user or null.
 */
export function currentUser() {
  return auth.currentUser;
}

// Map Firebase error codes to human-readable messages
function friendlyError(code) {
  const map = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}
