import React, { useState } from 'react';
import { X, Check, CreditCard, ShieldCheck, Zap } from 'lucide-react';
import { upgradeToPro } from '../lib/firebase';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
  userEmail: string | undefined;
  onUpgradeSuccess: () => void;
}

export default function PricingModal({ isOpen, onClose, userId, userEmail, onUpgradeSuccess }: PricingModalProps) {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !userEmail) {
      setError("Please sign in to upgrade your subscription.");
      return;
    }

    if (cardNumber.length < 16 || expiry.length < 4 || cvv.length < 3 || !nameOnCard) {
      setError("Please fill in all credit card details correctly.");
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Simulate Stripe/payment gateway latency and upgrade
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const price = 59.99; // Pro Annual Plan price
      await upgradeToPro(userId, userEmail, price, 'Visa ending in ' + cardNumber.slice(-4));
      
      setSuccess(true);
      onUpgradeSuccess();
      
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || "An error occurred during transaction simulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100 animate-fade-in">
        
        {/* Left Side: Plan Info & Perks */}
        <div className="bg-slate-50 p-8 md:w-1/2 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-sky-100 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-current" />
                ANNUAL DEALS
              </span>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-1">PRO Membership</h3>
            <p className="text-slate-500 text-sm mb-6">Unlock infinite conversions and supercharged processing power.</p>
            
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-4xl font-extrabold text-slate-900">$4.99</span>
              <span className="text-slate-500 font-medium">/ month</span>
              <span className="text-xs text-slate-400 block mt-1 ml-2">(billed annually at $59.99)</span>
            </div>

            <ul className="space-y-4">
              {[
                "Unlimited conversions (No 3/day cap)",
                "Support file sizes up to 250MB",
                "Parallel bulk file conversion",
                "Priority cloud conversion speed",
                "24/7 dedicated email support",
                "Completely ad-free experience"
              ].map((perk, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                  <span className="bg-emerald-100 text-emerald-700 rounded-full p-0.5 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-sky-600 shrink-0" />
            <div className="text-xs text-slate-400">
              <span className="font-semibold text-slate-600 block">Secured checkout</span>
              256-bit SSL encryption. Cancel anytime directly in your account dashboard.
            </div>
          </div>
        </div>

        {/* Right Side: Simulated Checkout Form */}
        <div className="p-8 md:w-1/2 flex flex-col justify-between relative bg-white">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {success ? (
            <div className="flex flex-col items-center justify-center text-center h-full py-12">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Upgrade Successful!</h4>
              <p className="text-slate-500 text-sm">
                Congratulations! Your account has been upgraded to **PRO**. Enjoy unlimited access.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-5">
              <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-600" />
                Simulated Payment
              </h4>

              {error && (
                <div className="bg-rose-50 text-rose-600 text-xs font-medium p-3 rounded-lg border border-rose-100">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Name on Card
                </label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={nameOnCard}
                  onChange={(e) => setNameOnCard(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Card Number (16 Digits)
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="4000 1234 5678 9010"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Expiry (MMYY)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="1228"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    CVV
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={3}
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg py-2.5 mt-2 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pay $59.99 Now
                  </>
                )}
              </button>
            </form>
          )}
        </div>
        
      </div>
    </div>
  );
}
