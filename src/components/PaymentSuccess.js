// frontend/src/components/PaymentSuccess.js - Mobile-First Dark Theme
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('No session ID found');
        setLoading(false);
        return;
      }

      try {
        // Verify the payment with your backend
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/stripe/verify-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ sessionId })
        });

        if (!response.ok) {
          throw new Error('Payment verification failed');
        }

        const result = await response.json();
        console.log('✅ Payment verified:', result);

        // Wait a moment then redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);

      } catch (err) {
        console.error('❌ Payment verification error:', err);
        setError('Payment verification failed');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-300 font-bold text-2xl">I</span>
          </div>
          <div className="w-8 h-8 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-slate-50 mb-2">Verifying Payment</h2>
          <p className="text-slate-400">Please wait while we confirm your subscription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-50 mb-2">Payment Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-emerald-300 text-4xl">✓</span>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-slate-50 mb-2">Payment Successful!</h1>
        <p className="text-slate-400 mb-6">
          Welcome to Inventory Insights Professional! Your subscription is now active.
        </p>

        {/* Features Unlocked */}
        <div className="bg-emerald-900/20 rounded-lg p-4 mb-6 text-left border border-emerald-600">
          <h3 className="font-semibold text-emerald-300 mb-3">🎉 What's Now Available:</h3>
          <ul className="text-sm text-emerald-200 space-y-2">
            <li className="flex items-center">
              <span className="text-emerald-300 mr-2">✓</span>
              Unlimited inventory counting
            </li>
            <li className="flex items-center">
              <span className="text-emerald-300 mr-2">✓</span>
              Priority + Full count modes
            </li>
            <li className="flex items-center">
              <span className="text-emerald-300 mr-2">✓</span>
              Advanced reporting & exports
            </li>
            <li className="flex items-center">
              <span className="text-emerald-300 mr-2">✓</span>
              Priority email support
            </li>
          </ul>
        </div>

        {/* Auto-redirect notice */}
        <div className="bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-600">
          <p className="text-sm text-blue-300">
            <span className="font-medium">🚀 Redirecting to dashboard...</span><br/>
            You'll be automatically taken to your dashboard in a few seconds.
          </p>
        </div>

        {/* Manual navigation */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors"
        >
          Go to Dashboard Now
        </button>

        {/* Support info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Questions? Email us at support@inventoryinsights.app
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;