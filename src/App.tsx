import React, { useState, useEffect } from 'react';
import { 
  Layers, Scissors, Minimize2, FileImage, Files, FileText, FileUp, RefreshCw,
  Plus, Check, ChevronRight, User, Key, Mail, Shield, Sparkles, BarChart2,
  Settings, LogOut, CheckCircle2, AlertCircle, HelpCircle, Star, MessageSquareCode,
  DollarSign, ArrowRight, Zap, ListFilter, CreditCard, Activity, CheckCircle
} from 'lucide-react';
import { 
  auth, db, getUserProfile, createUserProfile, checkDailyUsageLimit, 
  submitUserFeedback, auth as firebaseAuth, downgradeToFree
} from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { UserProfile, ToolDefinition, UsageLog } from './types';
import ToolWrapper from './components/ToolWrapper';
import PricingModal from './components/PricingModal';
import AdminPanel from './components/AdminPanel';
import UsageChart from './components/UsageChart';

// Icon Map for Dynamic Tools Rendering
const IconMap: { [key: string]: React.ComponentType<any> } = {
  Layers,
  Scissors,
  Minimize2: Minimize2,
  FileImage,
  Files,
  FileText,
  FileUp,
  RefreshCw
};

// Available Tools List
const TOOLS: ToolDefinition[] = [
  { id: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF files into a single, cohesive document.', category: 'pdf', icon: 'Layers', tag: 'Popular' },
  { id: 'split-pdf', name: 'Split PDF', description: 'Extract specific page ranges or split every page into a standalone PDF.', category: 'pdf', icon: 'Scissors' },
  { id: 'compress-pdf', name: 'Compress PDF', description: 'Reduce PDF document sizes while preserving visual asset qualities.', category: 'pdf', icon: 'Minimize2', tag: 'Fast' },
  { id: 'pdf-to-img', name: 'PDF to Image', description: 'Render pages inside a PDF into high-fidelity downloadable image files.', category: 'pdf', icon: 'FileImage' },
  { id: 'img-to-pdf', name: 'Image to PDF', description: 'Compile multiple PNG or JPEG files into a single formatted PDF.', category: 'image', icon: 'Files' },
  { id: 'pdf-to-word', name: 'PDF to Word', description: 'Extract text blocks and formatting from PDF files into editable word documents.', category: 'convert', icon: 'FileText' },
  { id: 'word-to-pdf', name: 'Word to PDF', description: 'Convert text strings or uploaded DOC documents into clean PDFs.', category: 'convert', icon: 'FileUp' },
  { id: 'img-converter', name: 'Image Converter', description: 'Instantly convert PNG, JPEG, and WEBP image file configurations.', category: 'image', icon: 'RefreshCw' },
];

export default function App() {
  // Authentication & Profile States
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'admin-login'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [appLoading, setAppLoading] = useState(true);

  // Interface Navigation States
  const [activeTab, setActiveTab] = useState<'tools' | 'dashboard' | 'admin'>('tools');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [toolCategory, setToolCategory] = useState<'all' | 'pdf' | 'image' | 'convert'>('all');

  // Limit & Usage States
  const [limitStatus, setLimitStatus] = useState<{ allowed: boolean; count: number; limit: number }>({ allowed: true, count: 0, limit: 3 });
  const [recentLogs, setRecentLogs] = useState<UsageLog[]>([]);

  // Pricing & Feedback States
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Authenticate & Profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Sync custom firestore profile
        let userProfile = await getUserProfile(user.uid);
        if (!userProfile) {
          // Fallback create profile
          userProfile = await createUserProfile(user.uid, user.email || '', user.displayName || '');
        }
        setProfile(userProfile);
        
        // Sync limit and user audit log metrics
        await syncUserMetrics(user.uid);
      } else {
        setProfile(null);
        setRecentLogs([]);
        setLimitStatus({ allowed: true, count: 0, limit: 3 });
      }
      setAppLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const syncUserMetrics = async (uid: string) => {
    // Check usage limits
    const limitCheck = await checkDailyUsageLimit(uid);
    setLimitStatus(limitCheck);

    // Pull last 15 usage records
    try {
      const logsRef = collection(db, 'users', uid, 'usageLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(15));
      const snapshot = await getDocs(q);
      const logsList: UsageLog[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() } as UsageLog);
      });
      setRecentLogs(logsList);
    } catch (e) {
      console.warn("Could not query user usage history:", e);
    }
  };

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all requested fields.');
      setAuthLoading(false);
      return;
    }

    try {
      if (authMode === 'admin-login') {
        if (authEmail.trim().toLowerCase() !== 'admin@swiftpdf.com' || authPassword !== 'AdminSecure2026!') {
          throw new Error("Access Denied: Only designated administrators can log in via this portal with official admin credentials.");
        }
        // Admin user login successful
        const demoProf = {
          uid: 'demo-admin',
          email: 'lakshmanaperumal321@gmail.com',
          displayName: 'Lakshman (Admin)',
          createdAt: new Date().toISOString(),
          tier: 'pro' as const,
          subscriptionExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          isAdmin: true
        };
        setProfile(demoProf);
        await syncUserMetrics('demo-admin');
        setActiveTab('admin');
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        return;
      }

      if (authMode === 'login') {
        // Automatically support admin credentials in regular sign in too
        if (authEmail.trim().toLowerCase() === 'admin@swiftpdf.com' && authPassword === 'AdminSecure2026!') {
          const demoProf = {
            uid: 'demo-admin',
            email: 'lakshmanaperumal321@gmail.com',
            displayName: 'Lakshman (Admin)',
            createdAt: new Date().toISOString(),
            tier: 'pro' as const,
            subscriptionExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            isAdmin: true
          };
          setProfile(demoProf);
          await syncUserMetrics('demo-admin');
          setActiveTab('admin');
          setAuthEmail('');
          setAuthPassword('');
          setAuthName('');
          return;
        }

        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        if (authPassword.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await createUserProfile(userCredential.user.uid, authEmail, authName);
      }
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      console.error(err);
      let cleanMsg = err.message || "Authentication failed.";
      if (cleanMsg.includes('auth/invalid-credential')) {
        cleanMsg = "Incorrect email address or password combination.";
      } else if (cleanMsg.includes('auth/email-already-in-use')) {
        cleanMsg = "Email address is already registered.";
      }
      setAuthError(cleanMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedTool(null);
    setActiveTab('tools');
  };

  // Downgrade user account action (Billing cancel)
  const handleCancelSubscription = async () => {
    if (!profile) return;
    if (window.confirm("Are you sure you want to cancel your Pro plan and return to the Free Tier?")) {
      try {
        await downgradeToFree(profile.uid);
        const updated = await getUserProfile(profile.uid);
        setProfile(updated);
        await syncUserMetrics(profile.uid);
      } catch (err) {
        alert("Could not downgrade account at this time.");
      }
    }
  };

  // Submit Feedback Log
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!feedbackMsg.trim()) {
      setFeedbackError("Please write a small suggestion message.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError('');
    
    try {
      await submitUserFeedback(profile.uid, profile.email, profile.displayName, feedbackMsg, feedbackRating);
      setFeedbackSuccess(true);
      setFeedbackMsg('');
      setFeedbackRating(5);
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      setFeedbackError("Could not log feedback. Please try again later.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleToolSuccess = async () => {
    if (profile) {
      await syncUserMetrics(profile.uid);
    }
  };

  // Filter tools based on category selection
  const filteredTools = TOOLS.filter(
    (t) => toolCategory === 'all' || t.category === toolCategory
  );

  if (appLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3.5">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-sky-600 rounded-full animate-spin" />
          <Sparkles className="w-5 h-5 text-sky-500 absolute top-3.5 left-3.5 animate-pulse" />
        </div>
        <p className="text-slate-500 text-sm font-semibold tracking-wide">Syncing secure SaaS workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-700 font-sans antialiased gradient-bg">
      
      {/* SaaS Premium Navbar Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setSelectedTool(null); setActiveTab('tools'); }}>
          <div className="w-9 h-9 bg-sky-600 text-white rounded-xl flex items-center justify-center font-black shadow-md shadow-sky-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 leading-none">SwiftPDF</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">SaaS Suite</p>
          </div>
        </div>

        {/* Desktop Navigation Category Selector */}
        {activeTab === 'tools' && !selectedTool && (
          <div className="hidden md:flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            {[
              { id: 'all', label: 'All Tools' },
              { id: 'pdf', label: 'PDF Utilities' },
              { id: 'image', label: 'Image Tools' },
              { id: 'convert', label: 'Converters' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setToolCategory(cat.id as any)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  toolCategory === cat.id 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* User Workspace Panel or Log In Prompt */}
        <div className="flex items-center gap-3">
          {profile ? (
            <div className="flex items-center gap-3">
              {/* Main Tabs Navigation */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => { setActiveTab('tools'); setSelectedTool(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'tools' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tools
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dashboard
                </button>
              </div>

              {/* Pro upgrade Callout */}
              {profile.tier === 'free' && (
                <button
                  onClick={() => setIsPricingOpen(true)}
                  className="hidden sm:flex bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
                  Go Pro
                </button>
              )}

              {/* Private Admin Control (Only for Admin Accounts, removed from Navigation tabs) */}
              {profile.isAdmin && (
                <button
                  onClick={() => {
                    setActiveTab(activeTab === 'admin' ? 'tools' : 'admin');
                    setSelectedTool(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                    activeTab === 'admin'
                      ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700'
                      : 'bg-amber-50 border-amber-200/60 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
                  }`}
                  title="Toggle Admin Control Center"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{activeTab === 'admin' ? 'Exit Admin' : 'Admin Area'}</span>
                </button>
              )}

              {/* User Dropdown menu avatar */}
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="w-8 h-8 bg-sky-50 border border-sky-100 rounded-full flex items-center justify-center font-bold text-sky-700 text-xs">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1.5"
                  title="Log out workspace"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setSelectedTool(null); setActiveTab('tools'); }}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
            >
              Access workspace
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main SaaS Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-8">
        
        {/* Unauthenticated View or Authentication form when trying to use workspace */}
        {!profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8">
            
            {/* Landing Copy Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <span className="bg-sky-50 text-sky-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-sky-100 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500 fill-current" />
                All-in-one Document Conversion SaaS Suite
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Modern tools to process <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600">PDFs & Images</span> instantly.
              </h2>
              <p className="text-slate-500 text-base max-w-xl leading-relaxed">
                SwiftPDF empowers team members to merge, split, compress, and convert document layers completely client-side. Zero server-upload delays. Extreme local privacy.
              </p>

              {/* Conversion Perk Lists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  "8+ fully interactive conversion tools",
                  "3 free daily conversion resets",
                  "100% client-side data safety",
                  "Convert to Word, Images or PDFs"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm text-slate-600 font-medium">
                    <span className="bg-emerald-50 text-emerald-600 rounded-full p-1 border border-emerald-100">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Premium Auth Portal Card */}
            <div className="lg:col-span-5 bg-white border border-slate-100 shadow-xl rounded-3xl p-6 sm:p-8">
              {/* Dynamic Auth Mode Selector Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/50">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'signup'
                      ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Register
                </button>
                <button
                  onClick={() => { setAuthMode('admin-login'); setAuthError(''); }}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    authMode === 'admin-login'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-amber-700'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  Admin
                </button>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {authMode === 'login' && 'Welcome Back!'}
                  {authMode === 'signup' && 'Create Free Account'}
                  {authMode === 'admin-login' && 'Admin Control Portal'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {authMode === 'login' && 'Access your workspace and subscription logs'}
                  {authMode === 'signup' && 'Sign up in seconds to start converting files'}
                  {authMode === 'admin-login' && 'Authorized personnel only. Credentials required.'}
                </p>
              </div>

              {authError && (
                <div className="bg-rose-50 text-rose-600 text-xs font-medium p-4 rounded-xl border border-rose-100 mb-5 space-y-2">
                  <div className="flex gap-2 font-semibold items-center">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                    <span>Authentication Notice</span>
                  </div>
                  <p className="text-rose-700/90 leading-relaxed">{authError}</p>
                </div>
              )}

              {/* Administrative Credentials Helper Box (Shown ONLY when admin-login mode is active) */}
              {authMode === 'admin-login' && (
                <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-4 text-xs text-amber-900 space-y-2.5 mb-5">
                  <div className="flex gap-2 font-bold items-center text-amber-800">
                    <Shield className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Administrator Credentials</span>
                  </div>
                  <p className="text-amber-700/90 leading-relaxed">
                    Use these secure credentials to access the SaaS administrative command center:
                  </p>
                  <div className="bg-white/90 border border-amber-200/40 rounded-xl p-3 font-mono text-[11px] space-y-1.5 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Email:</span>
                      <span className="font-bold text-slate-800 select-all">admin@swiftpdf.com</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100/60 pt-1.5">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Password:</span>
                      <span className="font-bold text-slate-800 select-all font-mono">AdminSecure2026!</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail('admin@swiftpdf.com');
                      setAuthPassword('AdminSecure2026!');
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[10.5px] uppercase tracking-wider transition-all shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    ⚡ Quick Autofill Credentials
                  </button>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl w-full focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder={authMode === 'admin-login' ? 'admin@swiftpdf.com' : 'you@example.com'}
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl w-full focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Password (Min 6 Characters)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl w-full focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className={`w-full py-3 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    authMode === 'admin-login' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {authLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {authMode === 'admin-login' ? 'Admin Access Login' : authMode === 'login' ? 'Sign In' : 'Create Free Account'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Dynamic Bottom Mode Toggle Links */}
              <div className="text-center mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2">
                {authMode === 'admin-login' ? (
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
                  >
                    Return to Standard User Login
                  </button>
                ) : (
                  <button
                    onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
                  >
                    {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                )}
              </div>

              {/* Sandbox Demo Mode Section */}
              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Or Sandbox Demo</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-center text-slate-400 font-medium leading-relaxed">
                  Bypass auth configuration entirely and test all user role tiers instantly:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const demoProf = {
                        uid: 'demo-free',
                        email: 'demo-user@saaspdf.com',
                        displayName: 'Demo Free User',
                        createdAt: new Date().toISOString(),
                        tier: 'free' as const,
                        subscriptionExpires: null,
                        isAdmin: false
                      };
                      setProfile(demoProf);
                      syncUserMetrics('demo-free');
                    }}
                    className="py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-sky-600 border border-slate-200/65 rounded-xl text-[10px] font-bold shadow-2xs transition-all cursor-pointer text-center"
                  >
                    Free User
                  </button>
                  <button
                    onClick={() => {
                      const demoProf = {
                        uid: 'demo-pro',
                        email: 'demo-premium@saaspdf.com',
                        displayName: 'Demo Pro User',
                        createdAt: new Date().toISOString(),
                        tier: 'pro' as const,
                        subscriptionExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        isAdmin: false
                      };
                      setProfile(demoProf);
                      syncUserMetrics('demo-pro');
                    }}
                    className="py-2.5 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-bold shadow-2xs transition-all cursor-pointer text-center"
                  >
                    Pro User
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Active Authenticated Views */
          <div>
            
            {/* View Tab 1: Tools Workspace */}
            {activeTab === 'tools' && (
              <div className="space-y-6">
                
                {/* Active Tool Workspace Back Navigation */}
                {selectedTool ? (
                  <div className="space-y-6 animate-fade-in">
                    <button
                      onClick={() => setSelectedTool(null)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      ← Back to Tools List
                    </button>
                    
                    <ToolWrapper
                      toolId={selectedTool.id}
                      toolName={selectedTool.name}
                      toolDescription={selectedTool.description}
                      userId={profile?.uid}
                      userTier={profile?.tier as any}
                      onLimitExceeded={() => {
                        setIsPricingOpen(true);
                      }}
                      onLoggedSuccess={handleToolSuccess}
                    />
                  </div>
                ) : (
                  /* Standard Tools Grid Menu */
                  <div className="space-y-6">
                    {/* Welcome Header & Limit Alert meter */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl gap-4 shadow-xs">
                      <div>
                        <h2 className="text-lg font-black text-slate-800">Hi, {profile.displayName}!</h2>
                        <p className="text-xs text-slate-400">Select any tool below to begin processing documents locally.</p>
                      </div>

                      {profile.tier === 'free' && (
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-xl shrink-0">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-500">Daily Free Resets</span>
                              <span className="font-bold text-slate-700">{limitStatus.count} / 3 used</span>
                            </div>
                            <div className="w-36 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${limitStatus.count >= 3 ? 'bg-rose-500' : 'bg-sky-500'}`}
                                style={{ width: `${Math.min(100, (limitStatus.count / 3) * 100)}%` }}
                              />
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setIsPricingOpen(true)}
                            className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <Zap className="w-3 h-3 fill-current" />
                            Go Unlimited
                          </button>
                        </div>
                      )}

                      {profile.tier === 'pro' && (
                        <div className="bg-emerald-50 text-emerald-700 border border-emerald-100/60 p-3 rounded-xl flex items-center gap-2 text-xs font-bold shadow-xs shrink-0">
                          <Zap className="w-4 h-4 fill-current animate-pulse text-amber-500" />
                          Unlimited Pro Subscription Active
                        </div>
                      )}
                    </div>

                    {/* Tools display cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {filteredTools.map((tool) => {
                        const Icon = IconMap[tool.icon] || FileText;
                        return (
                          <div
                            key={tool.id}
                            onClick={() => setSelectedTool(tool)}
                            className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs cursor-pointer card-hover hover:border-sky-100 flex flex-col justify-between h-48 relative overflow-hidden group"
                          >
                            {tool.tag && (
                              <span className="absolute top-3.5 right-3.5 bg-sky-100/60 text-sky-700 font-bold text-[9px] uppercase px-2 py-0.5 rounded-full border border-sky-100/30">
                                {tool.tag}
                              </span>
                            )}
                            <div className="w-11 h-11 bg-slate-50 group-hover:bg-sky-50 group-hover:text-sky-600 text-slate-500 rounded-xl flex items-center justify-center transition-colors shadow-2xs">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="mt-4">
                              <h3 className="font-bold text-slate-800 text-sm group-hover:text-sky-600 transition-colors flex items-center gap-1">
                                {tool.name}
                                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all text-sky-600" />
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{tool.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
              </div>
            )}

            {/* View Tab 2: Dashboard analytics, limits & user histories */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Dashboard overview blocks */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Profile Card, Usage tracker, Feedback Box */}
                  <div className="space-y-6">
                    
                    {/* Account card info */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                        <div className="w-12 h-12 bg-sky-50 text-sky-700 font-extrabold rounded-2xl flex items-center justify-center text-base border border-sky-100">
                          {profile.displayName.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{profile.displayName}</h3>
                          <p className="text-xs text-slate-400">{profile.email}</p>
                        </div>
                      </div>

                      <div className="pt-4 space-y-3.5 text-xs text-slate-500">
                        <div className="flex items-center justify-between">
                          <span>Account Status:</span>
                          <span className={`font-bold uppercase ${profile.tier === 'pro' ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {profile.tier} TIER
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Member Since:</span>
                          <span className="font-medium text-slate-700">{new Date(profile.createdAt).toLocaleDateString()}</span>
                        </div>
                        {profile.tier === 'pro' && profile.subscriptionExpires && (
                          <div className="flex items-center justify-between">
                            <span>Renews On:</span>
                            <span className="font-medium text-slate-700">{new Date(profile.subscriptionExpires).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-5 mt-4 border-t border-slate-100 flex gap-2">
                        {profile.tier === 'free' ? (
                          <button
                            onClick={() => setIsPricingOpen(true)}
                            className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            Upgrade Subscription
                          </button>
                        ) : (
                          <button
                            onClick={handleCancelSubscription}
                            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-xl text-xs transition-colors cursor-pointer font-semibold"
                          >
                            Cancel Pro Plan
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chart tracker */}
                    <UsageChart usageLogs={recentLogs} />

                    {/* Feedback Form Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Submit Recommendations</h4>
                        <p className="text-[10px] text-slate-400">Suggest tools or report any processing issues</p>
                      </div>

                      {feedbackSuccess ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          Feedback submitted. Thank you!
                        </div>
                      ) : (
                        <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                          {feedbackError && <p className="text-rose-500 text-[10px] font-bold">{feedbackError}</p>}
                          
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Rating</span>
                            <div className="flex gap-1.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setFeedbackRating(star)}
                                  className="cursor-pointer hover:scale-110 transition-transform"
                                >
                                  <Star className={`w-4 h-4 ${star <= feedbackRating ? 'fill-current' : 'text-slate-200'}`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          <textarea
                            rows={3}
                            required
                            placeholder="Write your feedback..."
                            value={feedbackMsg}
                            onChange={(e) => setFeedbackMsg(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:border-sky-500"
                          />

                          <button
                            type="submit"
                            disabled={feedbackSubmitting}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            {feedbackSubmitting ? 'Submitting...' : 'Send Message'}
                          </button>
                        </form>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Usage Audit history logs (Takes 2 Columns) */}
                  <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">Usage Audit History</h3>
                      <p className="text-xs text-slate-400">Review your past conversions and downloads</p>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                            <th className="py-3 px-4">Tool</th>
                            <th className="py-3 px-4">Output File</th>
                            <th className="py-3 px-4">Size</th>
                            <th className="py-3 px-4">Timestamp</th>
                            <th className="py-3 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                          {recentLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                No logs recorded yet. Convert some files to see logs!
                              </td>
                            </tr>
                          ) : (
                            recentLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-700">{log.toolName}</td>
                                <td className="py-3 px-4 text-slate-500 truncate max-w-[150px]" title={log.fileName}>
                                  {log.fileName}
                                </td>
                                <td className="py-3 px-4 text-slate-400">
                                  {(log.fileSize / 1024).toFixed(1)} KB
                                </td>
                                <td className="py-3 px-4 text-slate-400">
                                  {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold px-2 py-0.5 rounded-full text-[9px]">
                                    {log.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* View Tab 3: SaaS Administration Platform */}
            {activeTab === 'admin' && profile.isAdmin && (
              <AdminPanel />
            )}

          </div>
        )}

      </main>

      {/* Pricing Upgrade Modal popup */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        userId={profile?.uid}
        userEmail={profile?.email}
        onUpgradeSuccess={async () => {
          if (profile) {
            // Re-fetch upgraded profile data
            const userProfile = await getUserProfile(profile.uid);
            setProfile(userProfile);
            await syncUserMetrics(profile.uid);
          }
        }}
      />

      {/* SaaS footer copyright bar */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400 bg-white">
        <p>© 2026 SwiftPDF SaaS Platform. Fully compiled browser layouts. All rights reserved.</p>
      </footer>

    </div>
  );
}
