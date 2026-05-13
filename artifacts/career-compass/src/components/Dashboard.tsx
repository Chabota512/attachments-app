import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Application, UserProfile } from '../types';
import { Briefcase, Clock, CheckCircle, Search, ArrowRight, Compass, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate, cn } from '../lib/utils';
import { UserLocation } from '../App';

interface DashboardProps {
  profile: UserProfile | null;
  userLocation: UserLocation | null;
  onTabChange: (tab: any) => void;
}

export function Dashboard({ profile, userLocation, onTabChange }: DashboardProps) {
  const [stats, setStats] = useState({
    total: 0,
    applied: 0,
    interviewing: 0,
    offers: 0
  });
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      try {
        const appsRef = collection(db, 'applications');
        const q = query(appsRef, where('userId', '==', profile.uid));
        const snapshot = await getDocs(q);

        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application));

        setStats({
          total: apps.length,
          applied: apps.filter(a => a.status === 'Applied').length,
          interviewing: apps.filter(a => a.status === 'Interviewing').length,
          offers: apps.filter(a => a.status === 'Offer' || a.status === 'Accepted').length
        });

        const sorted = [...apps].sort((a, b) =>
          new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()
        ).slice(0, 3);

        setRecentApps(sorted);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'applications');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-5xl font-serif font-bold tracking-tight text-white leading-tight">
          Hello, {profile?.displayName?.split(' ')[0]}
        </h1>
        <p className="mt-3 text-white/50 font-sans text-lg">
          {userLocation
            ? <>Searching for <span className="text-indigo-400 font-semibold">{profile?.currentDegree}</span> opportunities near <span className="text-indigo-400 font-semibold">{userLocation.city}</span>.</>
            : <>Navigating your <span className="text-indigo-400 font-semibold">{profile?.currentDegree}</span> career path.</>
          }
        </p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Saved', val: stats.total, icon: Briefcase, color: 'bg-white/5 text-white' },
          { label: 'Applied', val: stats.applied, icon: Clock, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Interviews', val: stats.interviewing, icon: Search, color: 'bg-purple-500/10 text-purple-400' },
          { label: 'Offers', val: stats.offers, icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-400' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-8 rounded-[2rem] hover:bg-white/10 transition-all group"
          >
            <div className={stat.color + " w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 border border-white/5"}>
              <stat.icon className="w-7 h-7" />
            </div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{stat.label}</p>
            <p className="text-4xl font-serif font-bold text-white mt-2">{stat.val}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Recent Applications */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif font-medium text-white">Recent Applications</h2>
            <button
              onClick={() => onTabChange('tracker')}
              className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 group transition-colors"
            >
              View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="space-y-4">
            {recentApps.length > 0 ? (
              recentApps.map((app) => (
                <div key={app.id} className="glass-card p-6 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-white/20 font-bold">
                      {app.companyName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-white tracking-tight">{app.companyName}</h3>
                      <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{app.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm ring-1 ring-inset",
                      app.status === 'Interviewing' ? 'bg-purple-500/20 text-purple-300 ring-purple-500/30' :
                      app.status === 'Applied' ? 'bg-blue-500/20 text-blue-300 ring-blue-500/30' :
                      app.status === 'Offer' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30' : 'bg-white/10 text-white/60 ring-white/20'
                    )}>
                      {app.status}
                    </span>
                    <p className="text-[10px] text-white/20 mt-2 font-bold uppercase tracking-widest">Updated {formatDate(app.lastModified || '')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-card border-dashed p-12 rounded-[2rem] text-center opacity-50">
                <p className="text-white font-medium">No applications tracked yet.</p>
                <button
                  onClick={() => onTabChange('tracker')}
                  className="mt-4 text-white font-bold underline underline-offset-8 uppercase text-xs tracking-widest"
                >
                  Track your first application
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Discovery CTA */}
        <div className="glass backdrop-blur-3xl border-white/20 rounded-[2.5rem] p-10 text-white flex flex-col justify-between relative group overflow-hidden shadow-2xl">
          <div className="z-10 relative">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-10 border border-white/10">
              <Compass className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-3xl font-serif font-bold leading-tight">Find nearby internships</h3>
            <p className="mt-4 text-white/40 leading-relaxed font-medium">
              {userLocation
                ? <>AI-powered search near <span className="text-indigo-300">{userLocation.city}</span> for <span className="text-indigo-300">{profile?.currentDegree}</span> students.</>
                : <>AI-powered internship and job discovery based on your degree.</>
              }
            </p>
            {userLocation && (
              <div className="mt-4 flex items-center gap-2 text-white/30 text-xs font-bold uppercase tracking-widest">
                <MapPin className="w-3 h-3" />
                {userLocation.city}{userLocation.province ? `, ${userLocation.province}` : ''}
              </div>
            )}
          </div>
          <button
            onClick={() => onTabChange('discovery')}
            className="mt-12 w-full py-5 bg-white text-indigo-950 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/90 active:scale-[0.98] transition-all z-10 relative text-sm uppercase tracking-widest"
          >
            Find Opportunities
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
        </div>
      </div>
    </div>
  );
}
