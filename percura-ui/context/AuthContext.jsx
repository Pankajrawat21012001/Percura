"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    logOut: async () => { },
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);

            // Sync user data if logged in
            if (currentUser && db) {
                const userRef = doc(db, "users", currentUser.uid);
                setDoc(userRef, {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                    lastLogin: serverTimestamp(),
                }, { merge: true }).catch(err => console.error("User sync failed:", err));
            }
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (!auth || !db) {
            console.error("Firebase not initialized");
            return null;
        }
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Immediate save on login
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: serverTimestamp(),
            }, { merge: true });

            return user;
        } catch (error) {
            console.error("Authentication Error:", error);
            throw error;
        }
    };

    const logOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign Out Error:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, logOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
