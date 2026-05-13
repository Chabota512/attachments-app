/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOut } from './lib/firebase';
import { UserProfile } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Discovery } from './components/Discovery';
import { Tracker } from './components/Tracker';
import { Profile } from './components/Profile';
import { LogIn, Compass, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string;
  province: string;
}

async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; province: string }> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await res.json();
    return {
      city: data.city || data.locality || data.principalSubdivision || 'your area',
      province: data.principalSubdivision || '',
    };
  } catch {
    return { city: 'your area', province: '' };
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'discovery' | 'tracker' | 'profile'>('dashboard');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            currentDegree: '',
            careerGoals: '',
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            const { city, province } = await reverseGeocode(latitude, longitude);
            setUserLocation({ latitude, longitude, city, province });
          },
          () => {
            setLocationDenied(true);
          }
        );
      } else {
        setProfile(null);
        setUserLocation(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFCFB]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Compass className="w-8 h-8 text-neutral-400" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />

        <div className="max-w-md w-full space-y-8 glass p-12 rounded-[2.5rem] relative z-10">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
              <Compass className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-serif font-medium tracking-tight text-white">Career Compass</h1>
            <p className="mt-4 text-white/50 font-sans">
              Find internships and jobs near you, tailored to your degree.
            </p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white text-indigo-950 rounded-2xl font-bold hover:bg-white/90 transition-all active:scale-[0.98] shadow-xl shadow-white/5"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!profile?.currentDegree && activeTab !== 'profile') {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
            <UserCircle className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-serif font-medium text-neutral-900">Set up your profile</h2>
          <p className="mt-2 text-neutral-500 max-w-sm">
            Before we start, tell us what degree you're pursuing so we can tailor our recommendations.
          </p>
          <button
            onClick={() => setActiveTab('profile')}
            className="mt-8 px-8 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors"
          >
            Go to Profile
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard profile={profile} userLocation={userLocation} onTabChange={setActiveTab} />;
      case 'discovery': return <Discovery profile={profile} userLocation={userLocation} locationDenied={locationDenied} />;
      case 'tracker': return <Tracker profile={profile} />;
      case 'profile': return <Profile profile={profile} onUpdate={setProfile} onSignOut={signOut} />;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="mesh-blob mesh-blob-1" />
      <div className="mesh-blob mesh-blob-2" />

      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-6xl mx-auto"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </Layout>
    </div>
  );
}
