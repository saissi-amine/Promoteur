// =========================================================================
// TYPESCRIPT INTERFACES FOR PLATEFORME IMMO
// =========================================================================

/**
 * User roles in the Plateforme Immo system
 */
export type UserRole = 'admin' | 'promoteur' | 'ingenieur' | 'commercial' | 'client';

/**
 * User Profile information stored in public.profiles
 */
export interface IProfile {
  id: string; // UUID referencing auth.users.id
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ;
}

/**
 * Real estate project represented in public.projects
 */
export interface IProject {
  id: string; // UUID
  name: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'planning' | 'construction' | 'completed';
  created_at: string;
  updated_at: string;
}

/**
 * Project assignments mapping commercial/engineer users to specific projects
 */
export interface IProjectAssignment {
  project_id: string; // UUID referencing projects.id
  profile_id: string; // UUID referencing profiles.id
  assigned_role: 'commercial' | 'ingenieur' | null;
  created_at: string;
}

/**
 * Lot details (apartments/villas) in public.lots
 */
export interface ILot {
  id: string; // UUID
  project_id: string; // UUID referencing projects.id
  number: string;
  type: string; // e.g. 'F2', 'F3', 'Villa'
  status: 'available' | 'reserved' | 'sold'; // 'available' (green), 'reserved' (orange), 'sold' (red)
  price: number;
  client_id: string | null; // UUID referencing profiles.id (homebuyer)
  commercial_id: string | null; // UUID referencing profiles.id (sales agent)
  created_at: string;
  updated_at: string;
}

/**
 * Project development milestone milestones
 */
export interface IMilestone {
  id: string; // UUID
  project_id: string; // UUID referencing projects.id
  title: string;
  description: string | null;
  progress_percent: number; // 0 to 100
  is_validated: boolean;
  validated_at: string | null;
  validated_by: string | null; // UUID referencing profiles.id (engineer/admin)
  order_index: number;
  created_at: string;
  updated_at: string;
}

/**
 * Payment schedule and transactions in public.payments
 */
export interface IPayment {
  id: string; // UUID
  lot_id: string; // UUID referencing lots.id
  client_id: string; // UUID referencing profiles.id
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  due_date: string; // Date string
  paid_at: string | null;
  receipt_url: string | null; // Supabase storage URL
  created_at: string;
  updated_at: string;
}

/**
 * Digital Safe document in public.documents
 */
export interface IDocument {
  id: string; // UUID
  project_id: string | null;
  lot_id: string | null;
  client_id: string | null;
  title: string;
  type: 'contract' | 'plan' | 'receipt' | 'other';
  file_url: string; // Supabase storage URL
  created_by: string | null; // UUID referencing profiles.id
  created_at: string;
  updated_at: string;
}

/**
 * Snag issues (SAV) for issue tracking in public.snag_issues
 */
export interface ISnagIssue {
  id: string; // UUID
  lot_id: string; // UUID referencing lots.id
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high';
  reported_by: string | null; // UUID referencing profiles.id
  assigned_to: string | null; // UUID referencing profiles.id (engineer)
  subcontractor: string | null; // e.g. 'plumber', 'electrician'
  photo_url: string | null; // Supabase storage URL
  created_at: string;
  updated_at: string;
}
