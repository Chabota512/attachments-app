import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  pullSync,
  pushSync,
  type SyncMutation,
  type SyncRecord,
} from '@workspace/api-client-react';

import { useAuth } from './AuthContext';

export type ApplicationStatus = 'Interested' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Accepted';

export interface ProfileField {
  id: string;
  label: string;
  value: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  weeklyGoal?: number;
  currentDegree: string;
  institution?: string;
  yearOfStudy?: string;
  skills?: string;
  city?: string;
  preferredIndustries?: string;
  careerGoals: string;
  portfolioUrl?: string;
  profileFields?: ProfileField[];
}

export interface Application {
  id: string;
  companyName: string;
  role: string;
  status: ApplicationStatus;
  deadline?: string;
  notes?: string;
  appliedDate?: string;
  lastModified: string;
  createdDate?: string;
  draftedLetter?: string;
  researchSummary?: string;
  interviewQuestions?: { personal: string[]; company: string[]; experience: string[] };
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  howWeMet: string;
  notes?: string;
  isWarmLead: boolean;
  needsFollowUp: boolean;
  addedDate: string;
}

export interface SavedEvent {
  id: string;
  title: string;
  eventType: string;
  organizer: string;
  dateLabel: string;
  dateIso?: string;
  location: string;
  description?: string;
  url?: string;
  source?: string;
  tags?: string[];
  isOnline?: boolean;
  savedAt: string;
}

export interface CVDocument {
  id: string;
  title: string;
  targetIndustry: string;
  targetRole: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  profile: UserProfile | null;
  applications: Application[];
  contacts: Contact[];
  savedEvents: SavedEvent[];
  cvDocuments: CVDocument[];
  isLoaded: boolean;
  isCloudSyncing: boolean;
  pendingSyncCount: number;
  syncError: string | null;
  syncNow: () => Promise<void>;
  updateProfile: (p: UserProfile) => Promise<void>;
  addApplication: (data: Omit<Application, 'id' | 'lastModified'>) => Promise<Application>;
  updateApplication: (id: string, updates: Partial<Application>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  addContact: (data: Omit<Contact, 'id' | 'addedDate'>) => Promise<Contact>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  saveEvent: (event: Omit<SavedEvent, 'savedAt'>) => Promise<void>;
  unsaveEvent: (id: string) => Promise<void>;
  saveCVDocument: (document: Omit<CVDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<CVDocument>;
  deleteCVDocument: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const PROFILE_KEY = 'cc_profile';
const APPS_KEY = 'cc_applications';
const CONTACTS_KEY = 'cc_contacts';
const SAVED_EVENTS_KEY = 'cc_saved_events';
const CV_DOCUMENTS_KEY = 'cc_cv_documents';
const SYNC_QUEUE_KEY = 'cc_sync_queue';
const SYNC_CURSOR_KEY = 'cc_sync_cursor';

type SyncQueueItem = SyncMutation & {
  operation: 'upsert' | 'delete';
};

export function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function defaultProfile(): UserProfile {
  return { uid: genId(), displayName: 'You', currentDegree: '', careerGoals: '', weeklyGoal: 5 };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [cvDocuments, setCVDocuments] = useState<CVDocument[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rawProfile, rawApps, rawContacts, rawEvents, rawCVs, rawQueue] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(APPS_KEY),
          AsyncStorage.getItem(CONTACTS_KEY),
          AsyncStorage.getItem(SAVED_EVENTS_KEY),
          AsyncStorage.getItem(CV_DOCUMENTS_KEY),
          AsyncStorage.getItem(SYNC_QUEUE_KEY),
        ]);
        const p: UserProfile = rawProfile ? JSON.parse(rawProfile) : defaultProfile();
        if (!rawProfile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
        setProfile(p);
        setApplications(rawApps ? JSON.parse(rawApps) : []);
        setContacts(rawContacts ? JSON.parse(rawContacts) : []);
        setSavedEvents(rawEvents ? JSON.parse(rawEvents) : []);
        setCVDocuments(rawCVs ? JSON.parse(rawCVs) : []);
        setPendingSyncCount(rawQueue ? (JSON.parse(rawQueue) as SyncQueueItem[]).length : 0);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const saveApps = useCallback(async (apps: Application[]) => {
    setApplications(apps);
    await AsyncStorage.setItem(APPS_KEY, JSON.stringify(apps));
  }, []);

  const saveContacts = useCallback(async (ctcts: Contact[]) => {
    setContacts(ctcts);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(ctcts));
  }, []);

  const mergePulledRecords = useCallback(async (records: SyncRecord[]) => {
    let nextProfile = profile;
    let nextApplications = applications;
    let nextContacts = contacts;
    let nextEvents = savedEvents;
    let nextCVs = cvDocuments;

    for (const record of records) {
      const payload = record.payload as unknown;
      if (record.entity === 'profile' && !record.deletedAt) {
        nextProfile = payload as UserProfile;
      } else if (record.entity === 'applications') {
        const item = payload as Application;
        nextApplications = record.deletedAt
          ? nextApplications.filter(value => value.id !== record.recordId)
          : [item, ...nextApplications.filter(value => value.id !== record.recordId)];
      } else if (record.entity === 'contacts') {
        const item = payload as Contact;
        nextContacts = record.deletedAt
          ? nextContacts.filter(value => value.id !== record.recordId)
          : [item, ...nextContacts.filter(value => value.id !== record.recordId)];
      } else if (record.entity === 'savedEvents') {
        const item = payload as SavedEvent;
        nextEvents = record.deletedAt
          ? nextEvents.filter(value => value.id !== record.recordId)
          : [item, ...nextEvents.filter(value => value.id !== record.recordId)];
      } else if (record.entity === 'cvDocuments') {
        const item = payload as CVDocument;
        nextCVs = record.deletedAt
          ? nextCVs.filter(value => value.id !== record.recordId)
          : [item, ...nextCVs.filter(value => value.id !== record.recordId)];
      }
    }

    setProfile(nextProfile);
    setApplications(nextApplications);
    setContacts(nextContacts);
    setSavedEvents(nextEvents);
    setCVDocuments(nextCVs);
    await Promise.all([
      nextProfile ? AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile)) : Promise.resolve(),
      AsyncStorage.setItem(APPS_KEY, JSON.stringify(nextApplications)),
      AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(nextContacts)),
      AsyncStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(nextEvents)),
      AsyncStorage.setItem(CV_DOCUMENTS_KEY, JSON.stringify(nextCVs)),
    ]);
  }, [applications, contacts, cvDocuments, profile, savedEvents]);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsCloudSyncing(true);
    try {
      const rawQueue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue: SyncQueueItem[] = rawQueue ? JSON.parse(rawQueue) : [];
      let remaining = queue;

      if (queue.length > 0) {
        const result = await pushSync({ mutations: queue });
        remaining = queue.filter(item => !result.applied.includes(item.idempotencyKey));
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
        setPendingSyncCount(remaining.length);
        if (result.conflicts.length > 0) {
          setSyncError(`${result.conflicts.length} cloud conflict(s) need review.`);
        }
      }

      const since = await AsyncStorage.getItem(SYNC_CURSOR_KEY);
      const result = await pullSync({
        since: since ?? undefined,
        entities: ['profile', 'applications', 'contacts', 'savedEvents', 'cvDocuments'],
      });
      await mergePulledRecords(result.records);
      await AsyncStorage.setItem(SYNC_CURSOR_KEY, result.cursor);
      if (remaining.length === 0) setSyncError(null);
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : 'Cloud sync is unavailable.');
    } finally {
      setIsCloudSyncing(false);
    }
  }, [isAuthenticated, mergePulledRecords]);

  const queueMutation = useCallback(async (mutation: SyncQueueItem) => {
    const rawQueue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncQueueItem[] = rawQueue ? JSON.parse(rawQueue) : [];
    const next = [
      ...queue.filter(item => item.idempotencyKey !== mutation.idempotencyKey),
      mutation,
    ];
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
    setPendingSyncCount(next.length);
    if (isAuthenticated) void syncNow();
  }, [isAuthenticated, syncNow]);

  const updateProfile = useCallback(async (p: UserProfile) => {
    setProfile(p);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'profile',
      recordId: 'profile',
      operation: 'upsert',
      payload: p as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    });
  }, [queueMutation]);

  const addApplication = useCallback(async (data: Omit<Application, 'id' | 'lastModified'>) => {
    const now = new Date().toISOString();
    const app: Application = { ...data, id: genId(), lastModified: now, createdDate: now };
    setApplications(prev => {
      const next = [app, ...prev];
      void AsyncStorage.setItem(APPS_KEY, JSON.stringify(next));
      return next;
    });
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'applications',
      recordId: app.id,
      operation: 'upsert',
      payload: app as unknown as Record<string, unknown>,
      updatedAt: now,
    });
    return app;
  }, [queueMutation]);

  const updateApplication = useCallback(async (id: string, updates: Partial<Application>) => {
    const existing = applications.find(value => value.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates, lastModified: new Date().toISOString() };
    await saveApps(applications.map(value => value.id === id ? updated : value));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'applications',
      recordId: id,
      operation: 'upsert',
      payload: updated as unknown as Record<string, unknown>,
      updatedAt: updated.lastModified,
    });
  }, [applications, queueMutation, saveApps]);

  const deleteApplication = useCallback(async (id: string) => {
    await saveApps(applications.filter(value => value.id !== id));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'applications',
      recordId: id,
      operation: 'delete',
      updatedAt: new Date().toISOString(),
    });
  }, [applications, queueMutation, saveApps]);

  const addContact = useCallback(async (data: Omit<Contact, 'id' | 'addedDate'>) => {
    const contact: Contact = { ...data, id: genId(), addedDate: new Date().toISOString() };
    await saveContacts([contact, ...contacts]);
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'contacts',
      recordId: contact.id,
      operation: 'upsert',
      payload: contact as unknown as Record<string, unknown>,
      updatedAt: contact.addedDate,
    });
    return contact;
  }, [contacts, queueMutation, saveContacts]);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    const existing = contacts.find(value => value.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await saveContacts(contacts.map(value => value.id === id ? updated : value));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'contacts',
      recordId: id,
      operation: 'upsert',
      payload: updated as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    });
  }, [contacts, queueMutation, saveContacts]);

  const deleteContact = useCallback(async (id: string) => {
    await saveContacts(contacts.filter(value => value.id !== id));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'contacts',
      recordId: id,
      operation: 'delete',
      updatedAt: new Date().toISOString(),
    });
  }, [contacts, queueMutation, saveContacts]);

  const saveEvent = useCallback(async (event: Omit<SavedEvent, 'savedAt'>) => {
    if (savedEvents.some(value => value.id === event.id)) return;
    const saved: SavedEvent = { ...event, savedAt: new Date().toISOString() };
    const next = [saved, ...savedEvents];
    setSavedEvents(next);
    await AsyncStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(next));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'savedEvents',
      recordId: saved.id,
      operation: 'upsert',
      payload: saved as unknown as Record<string, unknown>,
      updatedAt: saved.savedAt,
    });
  }, [queueMutation, savedEvents]);

  const unsaveEvent = useCallback(async (id: string) => {
    setSavedEvents(prev => prev.filter(value => value.id !== id));
    await AsyncStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(savedEvents.filter(value => value.id !== id)));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'savedEvents',
      recordId: id,
      operation: 'delete',
      updatedAt: new Date().toISOString(),
    });
  }, [queueMutation, savedEvents]);

  const saveCVDocument = useCallback(async (
    data: Omit<CVDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => {
    const now = new Date().toISOString();
    const existing = data.id ? cvDocuments.find(document => document.id === data.id) : undefined;
    const savedDocument: CVDocument = {
      ...data,
      id: existing?.id ?? data.id ?? genId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing
      ? cvDocuments.map(document => document.id === existing.id ? savedDocument : document)
      : [savedDocument, ...cvDocuments];
    setCVDocuments(next);
    await AsyncStorage.setItem(CV_DOCUMENTS_KEY, JSON.stringify(next));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'cvDocuments',
      recordId: savedDocument.id,
      operation: 'upsert',
      payload: savedDocument as unknown as Record<string, unknown>,
      updatedAt: now,
    });
    return savedDocument;
  }, [cvDocuments, queueMutation]);

  const deleteCVDocument = useCallback(async (id: string) => {
    const next = cvDocuments.filter(document => document.id !== id);
    setCVDocuments(next);
    await AsyncStorage.setItem(CV_DOCUMENTS_KEY, JSON.stringify(next));
    await queueMutation({
      idempotencyKey: genId(),
      entity: 'cvDocuments',
      recordId: id,
      operation: 'delete',
      updatedAt: new Date().toISOString(),
    });
  }, [cvDocuments, queueMutation]);

  useEffect(() => {
    if (!isLoaded || !isAuthenticated || !user) return;
    const bootstrapKey = `cc_sync_bootstrap_${user.id}`;
    (async () => {
      if (!(await AsyncStorage.getItem(bootstrapKey))) {
        const updatedAt = new Date().toISOString();
        const snapshot: SyncQueueItem[] = [
          ...(profile ? [{
            idempotencyKey: genId(),
            entity: 'profile',
            recordId: 'profile',
            operation: 'upsert' as const,
            payload: profile as unknown as Record<string, unknown>,
            updatedAt,
          }] : []),
          ...applications.map(item => ({
            idempotencyKey: genId(),
            entity: 'applications',
            recordId: item.id,
            operation: 'upsert' as const,
            payload: item as unknown as Record<string, unknown>,
            updatedAt,
          })),
          ...contacts.map(item => ({
            idempotencyKey: genId(),
            entity: 'contacts',
            recordId: item.id,
            operation: 'upsert' as const,
            payload: item as unknown as Record<string, unknown>,
            updatedAt,
          })),
          ...savedEvents.map(item => ({
            idempotencyKey: genId(),
            entity: 'savedEvents',
            recordId: item.id,
            operation: 'upsert' as const,
            payload: item as unknown as Record<string, unknown>,
            updatedAt,
          })),
          ...cvDocuments.map(item => ({
            idempotencyKey: genId(),
            entity: 'cvDocuments',
            recordId: item.id,
            operation: 'upsert' as const,
            payload: item as unknown as Record<string, unknown>,
            updatedAt,
          })),
        ];
        if (snapshot.length) {
          const rawQueue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
          const queue: SyncQueueItem[] = rawQueue ? JSON.parse(rawQueue) : [];
          const next = [...queue, ...snapshot];
          await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
          setPendingSyncCount(next.length);
        }
        await AsyncStorage.setItem(bootstrapKey, '1');
      }
      await syncNow();
    })();
  }, [applications, contacts, cvDocuments, isAuthenticated, isLoaded, profile, savedEvents, syncNow, user]);

  return (
    <AppContext.Provider value={{
      profile, applications, contacts, savedEvents, cvDocuments, isLoaded,
      isCloudSyncing, pendingSyncCount, syncError, syncNow,
      updateProfile,
      addApplication, updateApplication, deleteApplication,
      addContact, updateContact, deleteContact,
      saveEvent, unsaveEvent,
      saveCVDocument, deleteCVDocument,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
