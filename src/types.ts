export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  tier: 'free' | 'pro';
  subscriptionExpires?: string | null;
  isAdmin: boolean;
}

export interface UsageLog {
  id?: string;
  toolId: string;
  toolName: string;
  timestamp: string;
  fileName: string;
  fileSize: number;
  status: 'success' | 'failed';
}

export interface Feedback {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  rating: number;
  timestamp: string;
  status: 'new' | 'resolved';
}

export interface Transaction {
  id?: string;
  userId: string;
  userEmail: string;
  amount: number;
  currency: string;
  planName: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  paymentMethod: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'pdf' | 'image' | 'convert';
  icon: string;
  tag?: string;
}
