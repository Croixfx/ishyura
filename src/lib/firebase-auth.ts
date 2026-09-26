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

export interface GoogleAuthResult {
  email: string;
  name: string;
  uid: string;
  photoURL?: string;
  accessToken?: string;
}

/**
 * Executes a real Google OAuth sign-in flow.
 * Tries Google Identity Services OAuth 2.0 popup first (most reliable on all web domains),
 * and falls back to Firebase Auth popup.
 */
export const signInWithGoogleReal = async (): Promise<GoogleAuthResult> => {
  if (isSigningIn) {
    throw new Error("Sign in is already in progress. Please check the open Google window.");
  }

  isSigningIn = true;

  try {
    const oAuthClientId =
      firebaseConfig.oAuthClientId ||
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      "502837741120-e83vucg1fvlv3upm4jnfpm0r8hr1bp47.apps.googleusercontent.com";

    // 1. Try Google Identity Services OAuth token client if available
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : {};
    const google = win.google as
      | {
          accounts?: {
            oauth2?: {
              initTokenClient: (opts: {
                client_id: string;
                scope: string;
                callback: (resp: {
                  access_token?: string;
                  error?: string;
                  error_description?: string;
                }) => void;
                error_callback?: (err: unknown) => void;
              }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
            };
          };
        }
      | undefined;

    if (google?.accounts?.oauth2 && oAuthClientId) {
      const gsiResult = await new Promise<GoogleAuthResult | null>((resolve, reject) => {
        try {
          const client = google.accounts!.oauth2!.initTokenClient({
            client_id: oAuthClientId,
            scope: "email profile openid",
            callback: async (resp) => {
              if (resp?.error) {
                if (resp.error === "access_denied") {
                  reject(new Error("Sign in was cancelled."));
                } else {
                  reject(new Error(resp.error_description || resp.error));
                }
                return;
              }

              if (resp?.access_token) {
                try {
                  cachedAccessToken = resp.access_token;
                  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                    headers: { Authorization: `Bearer ${resp.access_token}` },
                  });
                  const profile = (await res.json()) as {
                    sub?: string;
                    email?: string;
                    name?: string;
                    picture?: string;
                    given_name?: string;
                  };

                  if (profile?.email) {
                    resolve({
                      email: profile.email,
                      name:
                        profile.name || profile.given_name || profile.email.split("@")[0] || "User",
                      uid: profile.sub || profile.email,
                      photoURL: profile.picture,
                      accessToken: resp.access_token,
                    });
                    return;
                  }
                  reject(new Error("Could not retrieve profile from Google."));
                } catch (fetchErr) {
                  reject(fetchErr);
                }
              } else {
                reject(new Error("No access token returned by Google."));
              }
            },
            error_callback: (err) => {
              reject(err instanceof Error ? err : new Error("Google OAuth window error"));
            },
          });

          client.requestAccessToken({ prompt: "select_account" });
        } catch (initErr) {
          // If GSI init fails, resolve null to let Firebase popup try
          console.warn("GSI init warning, falling back to Firebase popup", initErr);
          resolve(null);
        }
      });

      if (gsiResult) {
        return gsiResult;
      }
    }

    // 2. Firebase Auth popup fallback
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    const email = result.user.email;
    if (!email) {
      throw new Error("No email found in Google account profile.");
    }

    const name = result.user.displayName || email.split("@")[0] || "User";

    return {
      email,
      name,
      uid: result.user.uid,
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
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
};
