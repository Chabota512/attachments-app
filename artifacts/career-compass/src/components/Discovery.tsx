import React, { useState } from 'react';
import { Compass, MapPin, Search, Plus, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { findNearbyCompanies, researchCompany } from '../lib/gemini';
import { CompanyDiscovery, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface DiscoveryProps {
  profile: UserProfile | null;
}

export function Discovery({ profile }: DiscoveryProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompanyDiscovery[]>([]);
  const [research, setResearch] = useState<string | null>(null);
  const [researching, setResearching] = useState<string | null>(null);

  const handleDiscover = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const companies = await findNearbyCompanies(latitude, longitude, profile?.currentDegree || '');
        setResults(companies);
        setLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Please enable location services to find companies nearby.");
        setLoading(false);
      }
    );
  };

  const handleResearch = async (name: string) => {
    setResearching(name);
    const data = await researchCompany(name);
    setResearch(data);
    setResearching(null);
  };

  const handleTrack = async (company: CompanyDiscovery) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'applications'), {
        userId: profile.uid,
        companyName: company.name,
        role: 'Position Identified',
        status: 'Interested',
        notes: company.description || '',
        appliedDate: null,
        lastModified: new Date().toISOString(),
        draftedLetter: '',
      });
      alert(`Added ${company.name} to your tracker!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'applications');
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-serif font-bold tracking-tight text-white leading-tight">
            Discover Opportunities
          </h1>
          <p className="mt-4 text-white/50 text-lg font-medium">
            Find companies around you looking for <span className="text-indigo-400">{profile?.currentDegree}</span> skills.
          </p>
        </div>
        <button
          onClick={handleDiscover}
          disabled={loading}
          className="bg-indigo-500 text-white px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-400 transition-all shadow-2xl shadow-indigo-500/20 disabled:opacity-50 group uppercase text-sm tracking-widest whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
          )}
          Find Companies Near Me
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AnimatePresence>
          {results.map((company, idx) => (
            <motion.div
              key={company.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card rounded-[2.5rem] p-10 flex flex-col hover:bg-white/10 transition-all group"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl font-serif font-bold text-white/20">
                  {company.name[0]}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleResearch(company.name)}
                    disabled={researching === company.name}
                    className="p-3 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                    title="Research with AI"
                  >
                    {researching === company.name ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Search className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => handleTrack(company)}
                    className="p-3 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                    title="Add to Tracker"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-6 flex-grow">
                <h3 className="text-3xl font-serif font-bold text-white tracking-tight">{company.name}</h3>
                <p className="text-white/50 leading-relaxed italic font-medium">"{company.description}"</p>
                
                <div className="bg-indigo-500/10 p-6 rounded-2xl border border-indigo-400/20 backdrop-blur-sm relative overflow-hidden group">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-[10px] uppercase tracking-[0.2em] mb-4 relative z-10">
                    <Sparkles className="w-3 h-3" />
                    AI Path Mapping
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed font-medium relative z-10">{company.fitScore}</p>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-400/5 blur-2xl -z-0" />
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => handleTrack(company)}
                  className="flex-grow py-4 bg-white text-indigo-950 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl shadow-white/5"
                >
                  Track Application
                </button>
                {company.website && (
                  <a 
                    href={company.website} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5 text-white/40" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {results.length === 0 && !loading && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-20">
            <Compass className="w-16 h-16 mb-4" />
            <p className="text-xl font-medium tracking-wide uppercase text-xs">Ready to explore? Run a geospatial scan.</p>
          </div>
        )}
      </div>

      {/* Research Modal */}
      <AnimatePresence>
        {research && (
          <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-md z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-[3rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border-white/20"
            >
              <div className="p-10 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h2 className="text-3xl font-serif font-bold text-white">Company Research</h2>
                <button onClick={() => setResearch(null)} className="text-white/40 hover:text-white transition-colors">✕</button>
              </div>
              <div className="p-12 overflow-y-auto prose prose-invert max-w-none prose-lg">
                <div className="whitespace-pre-wrap text-white/70 leading-loose">
                  {research}
                </div>
              </div>
              <div className="p-10 bg-white/5 border-t border-white/10 flex justify-end">
                <button 
                  onClick={() => setResearch(null)}
                  className="px-10 py-4 bg-white text-indigo-950 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-white/5"
                >
                  Close Data
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
