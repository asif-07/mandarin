export type MemberType = "china" | "global";
export type Plan = "china_yearly" | "global_monthly" | "trip_year";
export type ModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";
export type RequestStatus = "pending" | "approved" | "rejected";
export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed";

export interface PortfolioItem {
  title: string;
  description: string;
  image_url: string;
}

export interface Profile {
  id: string;
  full_name: string;
  bio: string;
  city: string;
  company: string;
  specialties: string[];
  languages: string[];
  avatar_url: string;
  cover_url: string;
  achievements: string[];
  portfolio: PortfolioItem[];
  created_at: string;
  updated_at: string;
}

export interface PublicMember extends Profile {
  member_type: "china";
  verified: boolean;
  rating: number | null;
  review_count: number;
  completed_connections: number;
}

export interface MembershipRequest {
  id: string;
  user_id: string;
  plan: Plan;
  reference: string;
  note: string;
  status: RequestStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface MembershipPeriod {
  id: string;
  plan: Plan;
  amount_rmb: number;
  starts_at: string;
  expires_at: string;
}

export interface Membership {
  member_type: MemberType;
  preferred_plan: Plan;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  active: boolean;
  current: MembershipPeriod | null;
  requests: MembershipRequest[];
}

export interface Connection {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
  sender: Pick<
    Profile,
    "id" | "full_name" | "avatar_url" | "company" | "city"
  > | null;
  recipient: Pick<
    Profile,
    "id" | "full_name" | "avatar_url" | "company" | "city"
  > | null;
  reviewed: boolean;
  contact_email: string | null;
}

export interface Review {
  id: string;
  connection_id: string;
  reviewer_id: string;
  recipient_id: string;
  rating: number;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewer_name: string;
}

export interface MeResponse {
  configured: boolean;
  user: { id: string; email: string; is_admin: boolean } | null;
  profile: Profile | null;
  membership: Membership | null;
  connections: Connection[];
}

export interface AdminQueues {
  profiles: Array<
    Profile & { member_type: MemberType; moderation_status: ModerationStatus }
  >;
  requests: Array<
    MembershipRequest & { full_name: string; member_type: MemberType }
  >;
  reviews: Review[];
}

export const PLAN_DETAILS: Record<
  Plan,
  { label: string; amount: number; duration: string }
> = {
  china_yearly: {
    label: "Ambro Connect China",
    amount: 1000,
    duration: "year",
  },
  global_monthly: {
    label: "Ambro Connect Global",
    amount: 100,
    duration: "month",
  },
  trip_year: {
    label: "Mandarin Roots trip benefit",
    amount: 0,
    duration: "year",
  },
};
