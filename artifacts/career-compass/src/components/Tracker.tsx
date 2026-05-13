import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Application, ApplicationStatus, UserProfile } from '../types';
import {
  FileText, Trash2, Edit3, Plus,
  CheckCircle2,
  Clock, XCircle, Sparkles, Loader2,
  Inbox, MessageSquare, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, cn } from '../lib/utils';
import { draftApplicationLetter } from '../lib/gemini';

interface TrackerProps {
  profile: UserProfile | null;
}

export function Tracker({ profile }: TrackerProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  useEffect(() => {
    if (!profile) return;

    const appsRef = collection(db, 'applications');
    const q = query(appsRef, where('userId', '==', profile.uid));

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application));
        setApplications(apps.sort((a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime()));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'applications')
    );

    return () => unsubscribe();
  }, [profile]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await updateDoc(doc(db, 'applications', id), {
        status,
        lastModified: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'applications');
    }
  };

  const deleteApp = async (id: string) => {
    if (!confirm('Are you sure you want to remove this application?')) return;
    try {
      await deleteDoc(doc(db, 'applications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'applications');
    }
  };

  const handleDraftLetter = async (app: Application) => {
    if (!profile) return;
    setDrafting(app.id);
    const letter = await draftApplicationLetter(app.companyName, app.role, profile.currentDegree, profile.careerGoals);

    try {
      await updateDoc(doc(db, 'applications', app.id), {
        draftedLetter: letter,
        lastModified: new Date().toISOString()
      });
      setSelectedApp({ ...app, draftedLetter: letter });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'applications');
    } finally {
      setDrafting(null);
    }
  };

  const statusIcons: Record<ApplicationStatus, any> = {
    'Interested': Inbox,
    'Applied': FileText,
    'Interviewing': MessageSquare,
    'Offer': CheckCircle2,
    'Rejected': XCircle,
    'Accepted': Briefcase
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-serif font-bold tracking-tight text-white leading-tight">
            My Applications
          </h1>
          <p className="mt-4 text-white/50 text-lg max-w-xl leading-relaxed font-medium">
            Track your applications and generate <span className="text-indigo-400">personalised cover letters</span> with AI.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-500 text-white px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-400 transition-all shadow-2xl shadow-indigo-500/20 uppercase text-xs tracking-[0.2em]"
        >
          <Plus className="w-5 h-5" />
          Add Application
        </button>
      </header>

      <div className="space-y-6">
        {applications.length > 0 ? (
          applications.map((app, idx) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="group glass-card rounded-[2.5rem] p-8 hover:bg-white/10 transition-all flex flex-col lg:flex-row lg:items-center gap-8 shadow-2xl"
            >
              <div className="flex items-center gap-6 lg:w-1/3">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white/20 text-2xl font-serif font-bold shrink-0 border border-white/10">
                  {app.companyName[0]}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-2xl font-serif font-bold text-white truncate tracking-tight">{app.companyName}</h3>
                  <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] mt-1">{app.role}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 lg:w-1/3 justify-center">
                {(['Interested', 'Applied', 'Interviewing', 'Offer'] as ApplicationStatus[]).map((s) => {
                  const Icon = statusIcons[s];
                  const isActive = app.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus(app.id, s)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all min-w-[70px]",
                        isActive
                          ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-white/5 border-white/5 text-white/20 hover:border-white/20 hover:text-white/60"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[8px] font-bold uppercase tracking-widest">{s}</span>
                    </button>
                  );
                })}
              </div>

              <div className="lg:w-1/3 flex items-center justify-end gap-3">
                <button
                  onClick={() => handleDraftLetter(app)}
                  disabled={!!drafting}
                  className="flex items-center gap-3 px-6 py-4 bg-white text-indigo-950 rounded-2xl font-bold hover:bg-white/90 transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest shadow-xl shadow-white/5"
                >
                  {drafting === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {app.draftedLetter ? 'View Letter' : 'Draft Letter'}
                </button>
                <div className="h-10 w-px bg-white/5 mx-2" />
                <button
                  onClick={() => setSelectedApp(app)}
                  className="p-3 text-white/20 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteApp(app.id)}
                  className="p-3 text-white/20 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] opacity-20">
            <Inbox className="w-12 h-12 text-white mx-auto mb-4" />
            <p className="text-xl font-serif text-white italic">No applications yet.</p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-6 text-white font-bold underline underline-offset-8 uppercase text-xs tracking-widest"
            >
              Add your first application
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md z-[70] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-[3rem] w-full max-w-lg p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-10 border-white/20"
            >
              <h2 className="text-3xl font-serif font-bold text-white tracking-tight italic">Add Application</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!profile) return;

                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const companyName = formData.get('companyName') as string;
                const role = formData.get('role') as string;

                try {
                  await addDoc(collection(db, 'applications'), {
                    userId: profile.uid,
                    companyName,
                    role,
                    status: 'Interested',
                    lastModified: new Date().toISOString(),
                    appliedDate: null,
                    notes: '',
                    draftedLetter: '',
                  });
                  setIsAdding(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, 'applications');
                }
              }} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Company Name</label>
                  <input name="companyName" required className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-indigo-500 transition-all font-semibold text-white placeholder:text-white/10" placeholder="e.g. Takealot, Vodacom, PwC..." />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Role / Position</label>
                  <input name="role" required className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-indigo-500 transition-all font-semibold text-white placeholder:text-white/10" placeholder="e.g. Internship, Junior Developer..." />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-grow py-5 glass border-white/10 rounded-2xl font-bold text-white/60 hover:bg-white/5 transition-all uppercase text-xs tracking-widest">Cancel</button>
                  <button type="submit" className="flex-grow py-5 bg-white text-indigo-950 rounded-2xl font-bold hover:bg-white/90 transition-all shadow-xl shadow-white/10 uppercase text-xs tracking-widest">Save</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail/Letter Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-md z-[70] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-[3.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-white/20"
            >
              <div className="p-12 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-white tracking-tight italic">{selectedApp.companyName}</h2>
                  <p className="text-indigo-300 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">{selectedApp.role}</p>
                </div>
                <button onClick={() => setSelectedApp(null)} className="p-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all">✕</button>
              </div>
              <div className="p-12 overflow-y-auto">
                {selectedApp.draftedLetter ? (
                  <div className="p-10 bg-white/5 border border-white/10 rounded-[2.5rem] font-serif text-white/80 leading-relaxed whitespace-pre-wrap italic text-lg shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 px-4 py-2 bg-indigo-500/20 text-indigo-200 text-[10px] font-bold tracking-widest border-l border-b border-white/10 rounded-bl-2xl">AI DRAFT</div>
                    {selectedApp.draftedLetter}
                  </div>
                ) : (
                  <div className="py-24 text-center opacity-20">
                    <Sparkles className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold uppercase tracking-widest text-xs">No letter drafted yet.</p>
                  </div>
                )}
              </div>
              <div className="p-10 bg-white/5 border-t border-white/10 flex gap-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedApp.draftedLetter || '');
                    alert('Copied to clipboard!');
                  }}
                  disabled={!selectedApp.draftedLetter}
                  className="flex-grow py-5 bg-white/5 border border-white/10 rounded-2xl font-bold text-white hover:bg-white/10 transition-all disabled:opacity-20 uppercase text-xs tracking-widest"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-12 py-5 bg-white text-indigo-950 rounded-2xl font-bold hover:bg-white/90 transition-all shadow-xl shadow-white/10 uppercase text-xs tracking-widest"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
