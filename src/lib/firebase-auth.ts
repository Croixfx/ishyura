import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const firebaseOptions = {
  apiKey:
    firebaseConfig.apiKey ||
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyChR6P0sbdN-DVLYOxsbPlHUQ_0vEp7Ryk",
  authDomain:
    firebaseConfig.authDomain ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "gen-lang-client-0261411374.firebaseapp.com",
  projectId:
    firebaseConfig.projectId ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    "gen-lang-client-0261411374",
  storageBucket:
    firebaseConfig.storageBucket ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "gen-lang-client-0261411374.firebasestorage.app",
  messagingSenderId:
    firebaseConfig.messagingSenderId ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    "502837741120",
  appId:
    firebaseConfig.appId ||
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:502837741120:web:16bcf4ca9b915e8b44c1a5",
};

const app = getApps().length === 0 ? initializeApp(firebaseOptions) : getApp();
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");
googleProvider.addScope("openid");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const signInWithGoogleReal = async (): Promise<{
  user: User;
  email: string;
  name: string;
  photoURL?: string;
  accessToken?: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    const email = result.user.email;
    if (!email) {
      throw new Error("No email found in Google account profile.");
    }

    const name = result.user.displayName || email.split("@")[0];

    return {
      user: result.user,
      email,
      name,
      photoURL: result.user.photoURL || undefined,
      accessToken: cachedAccessToken || undefined,
    };
  } catch (error: unknown) {
    console.error("Google sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
