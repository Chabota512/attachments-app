import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { UserCircle, LogOut, Save, GraduationCap, Target, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileProps {
  profile: UserProfile | null;
  onUpdate: (profile: UserProfile) => void;
  onSignOut: () => void;
}

export function Profile({ profile, onUpdate, onSignOut }: ProfileProps) {
  const [degree, setDegree] = useState(profile?.currentDegree || '');
  const [goals, setGoals] = useState(profile?.careerGoals || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'users', profile.uid);
      await updateDoc(docRef, {
        currentDegree: degree,
        careerGoals: goals,
        updatedAt: new Date().toISOString()
      });
      onUpdate({ ...profile, currentDegree: degree, careerGoals: goals });
      alert('Profile updated and stored.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <header className="text-center pt-8">
        <div className="mx-auto w-40 h-40 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-2xl relative">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
            alt="Avatar" 
            className="w-full h-full object-cover rounded-full"
          />
          <div className="absolute inset-0 rounded-full ring-2 ring-indigo-500/20" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-white italic tracking-tight">{profile?.displayName}</h1>
        <p className="mt-2 text-white/40 font-bold uppercase tracking-[0.3em] text-[10px]">{profile?.email}</p>
      </header>

      <form onSubmit={handleSave} className="glass rounded-[3rem] p-12 shadow-2xl space-y-12 border-white/10">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-400/20">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight">Academic Context</h2>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Credential Pursued</label>
            <input 
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              required
              className="w-full p-6 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-indigo-500 transition-all font-semibold text-white text-lg placeholder:text-white/10" 
              placeholder="e.g. Master of Computer Science" 
            />
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-400/20">
              <Target className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight">Career Architecture</h2>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Strategic Goals & Background</label>
            <textarea 
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={5}
              className="w-full p-6 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-indigo-500 transition-all font-semibold leading-relaxed resize-none text-lg text-white placeholder:text-white/10" 
              placeholder="Define your trajectory. This data powers the AI draft synthesis."
            />
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row gap-4">
          <button 
            type="submit"
            disabled={saving}
            className="flex-grow py-5 bg-white text-indigo-950 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-white/90 transition-all shadow-xl shadow-white/10 active:scale-[0.98] uppercase tracking-widest text-sm"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : <Save className="w-5 h-5" />}
            Update System Profile
          </button>
          
          <button 
            type="button"
            onClick={onSignOut}
            className="px-10 py-5 bg-white/5 border border-white/10 text-red-400 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:bg-red-500/10 transition-all uppercase tracking-widest text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </form>
    </div>
  );
}
