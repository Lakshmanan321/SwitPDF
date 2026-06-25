import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, MessageSquare, ShieldAlert, Search, RefreshCw, 
  Check, UserCheck, Star, Trash, Lock, Unlock, Mail, ShieldCheck 
} from 'lucide-react';
import { 
  adminGetAllUsers, adminUpdateUserTier, adminToggleAdminRole, 
  adminGetAllFeedback, adminResolveFeedback, adminGetAllTransactions 
} from '../lib/firebase';
import { UserProfile, Feedback, Transaction } from '../types';

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats calculation
  const totalUsers = users.length;
  const proUsers = users.filter((u) => u.tier === 'pro').length;
  const adminUsers = users.filter((u) => u.isAdmin).length;
  const totalRevenue = transactions.reduce((acc, tx) => acc + tx.amount, 0);
  const averageRating = feedback.length > 0 
    ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1) 
    : "N/A";

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [allUsers, allFeedback, allTransactions] = await Promise.all([
        adminGetAllUsers(),
        adminGetAllFeedback(),
        adminGetAllTransactions()
      ]);
      setUsers(allUsers);
      setFeedback(allFeedback);
      setTransactions(allTransactions);
    } catch (e) {
      console.error("Error loading admin datasets", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleTier = async (uid: string, currentTier: 'free' | 'pro') => {
    setActionLoading(uid + '_tier');
    try {
      const targetTier = currentTier === 'free' ? 'pro' : 'free';
      await adminUpdateUserTier(uid, targetTier);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, tier: targetTier } : u));
    } catch (err) {
      console.error("Error updating user tier", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (uid: string, currentAdmin: boolean) => {
    setActionLoading(uid + '_admin');
    try {
      await adminToggleAdminRole(uid, !currentAdmin);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isAdmin: !currentAdmin } : u));
    } catch (err) {
      console.error("Error updating admin role", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveFeedback = async (id: string | undefined) => {
    if (!id) return;
    setActionLoading(id + '_feedback');
    try {
      await adminResolveFeedback(id);
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status: 'resolved' } : f));
    } catch (err) {
      console.error("Error resolving feedback", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading SaaS Analytics datasets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Customers", value: totalUsers, desc: "SaaS registered accounts", icon: Users, color: "text-sky-600 bg-sky-50" },
          { label: "Premium Pro Users", value: proUsers, desc: `${((proUsers/totalUsers || 0)*100).toFixed(0)}% conversion rate`, icon: ShieldCheck, color: "text-emerald-600 bg-emerald-50" },
          { label: "Total Sales", value: `$${totalRevenue.toFixed(2)}`, desc: "Simulated revenue collected", icon: DollarSign, color: "text-amber-600 bg-amber-50" },
          { label: "User Satisfaction", value: `${averageRating}/5`, desc: `Based on ${feedback.length} feedbacks`, icon: MessageSquare, color: "text-indigo-600 bg-indigo-50" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{stat.value}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{stat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main grids for user, feedbacks, txs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Users Management (Takes 2 columns) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Customers Directory</h3>
              <p className="text-xs text-slate-400 mt-0.5">Edit subscription tiers and role configurations</p>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 w-full sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400 font-medium">No customers found</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 bg-sky-50 text-sky-700 font-bold rounded-full flex items-center justify-center border border-sky-100">
                              {user.displayName.substring(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{user.displayName}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[9px] w-max ${
                            user.tier === 'pro' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {user.tier.toUpperCase()}
                          </span>
                          {user.isAdmin && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold text-[9px] w-max">
                              ADMIN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleToggleTier(user.uid, user.tier)}
                          disabled={actionLoading !== null}
                          className={`px-2 py-1 rounded-md font-semibold text-[10px] border transition-colors cursor-pointer ${
                            user.tier === 'pro'
                              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                          }`}
                        >
                          {actionLoading === user.uid + '_tier' ? '...' : user.tier === 'pro' ? 'Downgrade' : 'Upgrade Pro'}
                        </button>
                        <button
                          onClick={() => handleToggleAdmin(user.uid, user.isAdmin)}
                          disabled={actionLoading !== null}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md font-semibold text-[10px] text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          {actionLoading === user.uid + '_admin' ? '...' : user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Feedback Logs */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Feedback & Ratings</h3>
            <p className="text-xs text-slate-400 mt-0.5">Review active customer tickets</p>
          </div>

          <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
            {feedback.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-xs">No feedback submitted yet</p>
            ) : (
              feedback.map((f) => (
                <div key={f.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100/60 relative">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-slate-700 text-xs truncate max-w-[120px]">{f.userName}</p>
                    <div className="flex gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < f.rating ? 'fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  
                  <p className="text-slate-500 text-[11px] leading-relaxed italic mt-1.5">"{f.message}"</p>
                  
                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-slate-200/40 text-[9px] text-slate-400">
                    <span>{new Date(f.timestamp).toLocaleDateString()}</span>
                    {f.status === 'resolved' ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> RESOLVED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolveFeedback(f.id)}
                        disabled={actionLoading === f.id + '_feedback'}
                        className="text-sky-600 hover:text-sky-700 font-bold uppercase cursor-pointer"
                      >
                        {actionLoading === f.id + '_feedback' ? '...' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Transactions audit list */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Simulated Transactions</h3>
          <p className="text-xs text-slate-400 mt-0.5">Real-time payment audit log for active memberships</p>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Plan Name</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">No transactions simulated yet</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{tx.id || 'TX_SIM_BLANK'}</td>
                    <td className="py-3 px-4 font-bold text-slate-700">{tx.userEmail}</td>
                    <td className="py-3 px-4 text-slate-500">{tx.planName}</td>
                    <td className="py-3 px-4 text-slate-400">{tx.paymentMethod}</td>
                    <td className="py-3 px-4 font-black text-slate-800">${tx.amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-400">{new Date(tx.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-full text-[9px]">
                        {tx.status.toUpperCase()}
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
  );
}
