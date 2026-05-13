export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  currentDegree: string;
  careerGoals: string;
  updatedAt?: string;
}

export type ApplicationStatus = 'Interested' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Accepted';

export interface Application {
  id: string;
  userId: string;
  companyName: string;
  role: string;
  status: ApplicationStatus;
  draftedLetter?: string;
  notes?: string;
  appliedDate?: string;
  lastModified?: string;
}

export interface CompanyDiscovery {
  name: string;
  description: string;
  fitScore: string;
  website?: string;
}
