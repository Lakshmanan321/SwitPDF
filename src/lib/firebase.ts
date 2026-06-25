import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  getDocFromServer,
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { UserProfile, UsageLog, Feedback, Transaction } from '../types';

// Config from firebase-applet-config.json
const firebaseConfig = {
  projectId: "noted-dispatcher-t8gvj",
  appId: "1:525361518127:web:213014c73f2d8ef8a3d8da",
  apiKey: "AIzaSyBR_paokh5XtSA6F3lilBMhaSvoVo8w-4M",
  authDomain: "noted-dispatcher-t8gvj.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-04e0649c-23b6-4aa8-b4dd-68f4523956dd",
  storageBucket: "noted-dispatcher-t8gvj.firebasestorage.app",
  messagingSenderId: "525361518127"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore (MANDATORY per skill)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firestore connection: Offline mode or network issue.", error);
    } else {
      console.log("Firestore connection test completed (note: test document may not exist, which is normal).");
    }
  }
}

// Call testConnection upon module load
testConnection();

// HELPER FOR DEMO STORAGE
function getDemoProfilesList(): UserProfile[] {
  const custom = localStorage.getItem('demo_profiles_list');
  if (custom) return JSON.parse(custom);

  const defaults: UserProfile[] = [
    {
      uid: 'demo-free',
      email: 'demo-user@saaspdf.com',
      displayName: 'Demo Free User',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      tier: 'free',
      subscriptionExpires: null,
      isAdmin: false
    },
    {
      uid: 'demo-pro',
      email: 'demo-premium@saaspdf.com',
      displayName: 'Demo Pro User',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      tier: 'pro',
      subscriptionExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isAdmin: false
    },
    {
      uid: 'demo-admin',
      email: 'lakshmanaperumal321@gmail.com',
      displayName: 'Lakshman (Admin)',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      tier: 'pro',
      subscriptionExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isAdmin: true
    }
  ];
  localStorage.setItem('demo_profiles_list', JSON.stringify(defaults));
  return defaults;
}

function saveDemoProfile(profile: UserProfile) {
  const list = getDemoProfilesList();
  const index = list.findIndex(p => p.uid === profile.uid);
  if (index !== -1) {
    list[index] = profile;
  } else {
    list.push(profile);
  }
  localStorage.setItem('demo_profiles_list', JSON.stringify(list));
  localStorage.setItem(`demo_profile_${profile.uid}`, JSON.stringify(profile));
}

// Get or Create User Profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (uid.startsWith('demo-')) {
    const list = getDemoProfilesList();
    const found = list.find(p => p.uid === uid);
    if (found) return found;

    // Default fallback
    const newDemoProfile: UserProfile = {
      uid,
      email: `${uid}@saaspdf.com`,
      displayName: `Demo User (${uid.replace('demo-', '')})`,
      createdAt: new Date().toISOString(),
      tier: uid === 'demo-pro' || uid === 'demo-admin' ? 'pro' : 'free',
      subscriptionExpires: uid === 'demo-pro' || uid === 'demo-admin' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
      isAdmin: uid === 'demo-admin'
    };
    saveDemoProfile(newDemoProfile);
    return newDemoProfile;
  }

  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function createUserProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
  const profile: UserProfile = {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    createdAt: new Date().toISOString(),
    tier: 'free',
    subscriptionExpires: null,
    isAdmin: email.toLowerCase() === 'lakshmanaperumal321@gmail.com' // Make user admin based on email
  };
  
  if (uid.startsWith('demo-')) {
    saveDemoProfile(profile);
    return profile;
  }

  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

// Check Daily Tool Usage Limit
// Free tier has a limit of 3 tools per day. Pro tier is unlimited.
export async function checkDailyUsageLimit(uid: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  if (uid.startsWith('demo-')) {
    const profile = await getUserProfile(uid);
    if (!profile) return { allowed: true, count: 0, limit: 3 };
    
    if (profile.tier === 'pro' || profile.isAdmin) {
      return { allowed: true, count: 0, limit: Infinity };
    }

    // Load from localStorage logs
    const logsStr = localStorage.getItem(`demo_usageLogs_${uid}`);
    const logs: UsageLog[] = logsStr ? JSON.parse(logsStr) : [];
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();

    const todayLogs = logs.filter(log => log.timestamp >= startOfTodayStr);
    const count = todayLogs.length;

    return {
      allowed: count < 3,
      count,
      limit: 3
    };
  }

  try {
    const profile = await getUserProfile(uid);
    if (!profile) return { allowed: true, count: 0, limit: 3 };
    
    if (profile.tier === 'pro' || profile.isAdmin) {
      return { allowed: true, count: 0, limit: Infinity };
    }
    
    // Get start of today in local time ISO
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();
    
    // Query usage logs for today
    const logsRef = collection(db, 'users', uid, 'usageLogs');
    const q = query(
      logsRef,
      where('timestamp', '>=', startOfTodayStr)
    );
    
    const querySnapshot = await getDocs(q);
    const count = querySnapshot.size;
    
    return {
      allowed: count < 3,
      count,
      limit: 3
    };
  } catch (error) {
    console.error("Error checking daily limit:", error);
    // Graceful fallback (allow but log)
    return { allowed: true, count: 0, limit: 3 };
  }
}

// Log Tool Usage
export async function logToolUsage(
  uid: string, 
  toolId: string, 
  toolName: string, 
  fileName: string, 
  fileSize: number
): Promise<void> {
  const newLog: UsageLog = {
    id: `log-${Date.now()}`,
    toolId,
    toolName,
    timestamp: new Date().toISOString(),
    fileName,
    fileSize,
    status: 'success'
  };

  if (uid.startsWith('demo-')) {
    const logsStr = localStorage.getItem(`demo_usageLogs_${uid}`);
    const logs: UsageLog[] = logsStr ? JSON.parse(logsStr) : [];
    logs.unshift(newLog);
    localStorage.setItem(`demo_usageLogs_${uid}`, JSON.stringify(logs));
    return;
  }

  try {
    const logsRef = collection(db, 'users', uid, 'usageLogs');
    await addDoc(logsRef, newLog);
  } catch (error) {
    console.error("Error logging tool usage:", error);
  }
}

// Log payment / billing transaction
export async function logTransaction(
  uid: string,
  userEmail: string,
  amount: number,
  planName: string,
  paymentMethod: string
): Promise<void> {
  const transaction: Transaction = {
    id: `tx-${Date.now()}`,
    userId: uid,
    userEmail,
    amount,
    currency: 'USD',
    planName,
    status: 'completed',
    timestamp: new Date().toISOString(),
    paymentMethod
  };

  if (uid.startsWith('demo-')) {
    const txsStr = localStorage.getItem('demo_transactions');
    const txs: Transaction[] = txsStr ? JSON.parse(txsStr) : [];
    txs.unshift(transaction);
    localStorage.setItem('demo_transactions', JSON.stringify(txs));
    return;
  }

  try {
    const txRef = collection(db, 'transactions');
    await addDoc(txRef, transaction);
  } catch (error) {
    console.error("Error logging transaction:", error);
  }
}

// Upgrade User to Pro
export async function upgradeToPro(uid: string, userEmail: string, amount: number, paymentMethod: string): Promise<void> {
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (uid.startsWith('demo-')) {
    const profile = await getUserProfile(uid);
    if (profile) {
      profile.tier = 'pro';
      profile.subscriptionExpires = oneYearFromNow.toISOString();
      saveDemoProfile(profile);
    }
    await logTransaction(uid, userEmail, amount, 'Pro Annual Plan', paymentMethod);
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    tier: 'pro',
    subscriptionExpires: oneYearFromNow.toISOString()
  });
  
  await logTransaction(uid, userEmail, amount, 'Pro Annual Plan', paymentMethod);
}

// Cancel / Downgrade Subscription
export async function downgradeToFree(uid: string): Promise<void> {
  if (uid.startsWith('demo-')) {
    const profile = await getUserProfile(uid);
    if (profile) {
      profile.tier = 'free';
      profile.subscriptionExpires = null;
      saveDemoProfile(profile);
    }
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    tier: 'free',
    subscriptionExpires: null
  });
}

// Submit Feedback
export async function submitUserFeedback(
  uid: string,
  email: string,
  name: string,
  message: string,
  rating: number
): Promise<void> {
  const feedback: Feedback = {
    id: `fb-${Date.now()}`,
    userId: uid,
    userEmail: email,
    userName: name,
    message,
    rating,
    timestamp: new Date().toISOString(),
    status: 'new'
  };

  if (uid.startsWith('demo-')) {
    const fbsStr = localStorage.getItem('demo_feedback');
    const fbs: Feedback[] = fbsStr ? JSON.parse(fbsStr) : [];
    fbs.unshift(feedback);
    localStorage.setItem('demo_feedback', JSON.stringify(fbs));
    return;
  }

  const feedbackRef = collection(db, 'feedback');
  await addDoc(feedbackRef, feedback);
}

// ADMIN FUNCTIONS

// Get All Users (Admin only)
export async function adminGetAllUsers(): Promise<UserProfile[]> {
  const demoUsers = getDemoProfilesList();
  
  if (!auth.currentUser || auth.currentUser.uid.startsWith('demo-')) {
    return demoUsers;
  }
  
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const users: UserProfile[] = [];
    snapshot.forEach((doc) => {
      const u = doc.data() as UserProfile;
      // Don't duplicate if they overlap
      if (!demoUsers.some(du => du.uid === u.uid)) {
        users.push(u);
      }
    });
    return [...demoUsers, ...users];
  } catch (error: any) {
    console.error("Error getting all users:", error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
    return demoUsers;
  }
}

// Update User Tier (Admin only)
export async function adminUpdateUserTier(uid: string, tier: 'free' | 'pro'): Promise<void> {
  if (uid.startsWith('demo-')) {
    const profile = await getUserProfile(uid);
    if (profile) {
      profile.tier = tier;
      profile.subscriptionExpires = tier === 'pro' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null;
      saveDemoProfile(profile);
    }
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    tier,
    subscriptionExpires: tier === 'pro' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null
  });
}

// Toggle Admin Role (Admin only)
export async function adminToggleAdminRole(uid: string, isAdmin: boolean): Promise<void> {
  if (uid.startsWith('demo-')) {
    const profile = await getUserProfile(uid);
    if (profile) {
      profile.isAdmin = isAdmin;
      saveDemoProfile(profile);
    }
    return;
  }

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, { isAdmin });
}

// Get All Feedback (Admin only)
export async function adminGetAllFeedback(): Promise<Feedback[]> {
  const fbsStr = localStorage.getItem('demo_feedback');
  const demoFeedback: Feedback[] = fbsStr ? JSON.parse(fbsStr) : [
    {
      id: 'demo-fb-1',
      userId: 'demo-pro',
      userEmail: 'demo-premium@saaspdf.com',
      userName: 'Demo Pro User',
      message: 'The split PDF tool is incredibly fast! Exactly what I needed for my scanned reports.',
      rating: 5,
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new'
    },
    {
      id: 'demo-fb-2',
      userId: 'demo-free',
      userEmail: 'demo-user@saaspdf.com',
      userName: 'Demo Free User',
      message: 'I love the UI! Could we get an option for page number overlays in future updates?',
      rating: 4,
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'resolved'
    }
  ];

  if (!auth.currentUser || auth.currentUser.uid.startsWith('demo-')) {
    return demoFeedback;
  }

  try {
    const q = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const feedbackList: Feedback[] = [];
    snapshot.forEach((doc) => {
      feedbackList.push({ id: doc.id, ...doc.data() } as Feedback);
    });
    return [...demoFeedback, ...feedbackList];
  } catch (error: any) {
    console.error("Error getting all feedback:", error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
      handleFirestoreError(error, OperationType.LIST, 'feedback');
    }
    return demoFeedback;
  }
}

// Resolve Feedback (Admin only)
export async function adminResolveFeedback(feedbackId: string): Promise<void> {
  if (feedbackId.startsWith('demo-') || feedbackId.startsWith('fb-')) {
    const fbsStr = localStorage.getItem('demo_feedback');
    const fbs: Feedback[] = fbsStr ? JSON.parse(fbsStr) : [];
    const found = fbs.find(f => f.id === feedbackId);
    if (found) {
      found.status = 'resolved';
      localStorage.setItem('demo_feedback', JSON.stringify(fbs));
      return;
    }
  }

  const docRef = doc(db, 'feedback', feedbackId);
  await updateDoc(docRef, { status: 'resolved' });
}

// Get All Transactions (Admin only)
export async function adminGetAllTransactions(): Promise<Transaction[]> {
  const txsStr = localStorage.getItem('demo_transactions');
  const demoTransactions: Transaction[] = txsStr ? JSON.parse(txsStr) : [
    {
      id: 'demo-tx-1',
      userId: 'demo-pro',
      userEmail: 'demo-premium@saaspdf.com',
      amount: 49,
      currency: 'USD',
      planName: 'Pro Annual Plan',
      status: 'completed',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      paymentMethod: 'credit_card'
    }
  ];

  if (!auth.currentUser || auth.currentUser.uid.startsWith('demo-')) {
    return demoTransactions;
  }

  try {
    const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const txs: Transaction[] = [];
    snapshot.forEach((doc) => {
      txs.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    return [...demoTransactions, ...txs];
  } catch (error: any) {
    console.error("Error getting all transactions:", error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
    return demoTransactions;
  }
}
