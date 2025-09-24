// frontend/src/components/StripePayment.js - Mobile-First Dark Theme
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { stripeConfig } from '../config/theme';

// Initialize Stripe
const stripePromise = loadStripe(stripeConfig.publishableKey);

const StripePayment = ({ user, onSubscriptionSuccess, onStartTrial }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [stripe, setStripe] = useState(null);

  useEffect(() => {
    const initStripe = async () => {
      const stripeInstance = await stripePromise;
      setStripe(stripeInstance);
    };
    initStripe();
  }, []);

  const handleStartTrial = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🆓 Starting 14-day free trial...');
      
      // Call your backend to start trial
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/stripe/start-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start trial');
      }

      await response.json();
      console.log('✅ Trial started successfully');
      
      onStartTrial();
    } catch (err) {
      console.error('❌ Trial start error:', err);
      setError('Failed to start trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscription = async () => {
    if (!stripe) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('💳 Creating Stripe checkout session...');

      // Create checkout session on your backend
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          priceId: stripeConfig.priceId,
          userId: user.id,
          userEmail: user.email,
          successUrl: stripeConfig.successUrl,
          cancelUrl: stripeConfig.cancelUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: sessionId
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

    } catch (err) {
      console.error('❌ Stripe checkout error:', err);
      setError('Payment setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-300 font-bold text-2xl">I</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Choose Your Plan</h1>
          <p className="text-slate-400 mt-2">Start counting inventory today</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-lg mb-6 border bg-red-900/20 border-red-400">
            <div className="flex items-center">
              <span className="mr-2 text-red-400">⚠️</span>
              <span className="text-sm font-medium text-red-400">{error}</span>
            </div>
          </div>
        )}

        {/* Plan Selection */}
        <div className="space-y-4 mb-6">
          {/* Free Trial Option */}
          <div 
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
              selectedPlan === 'trial' 
                ? 'border-emerald-300 bg-emerald-900/20' 
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
            }`}
            onClick={() => setSelectedPlan('trial')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-50">Free Trial</h3>
                <p className="text-sm text-slate-400">14 days free</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-50">$0</div>
                <div className="text-sm text-slate-400">for 14 days</div>
              </div>
              <input
                type="radio"
                name="plan"
                value="trial"
                checked={selectedPlan === 'trial'}
                onChange={() => setSelectedPlan('trial')}
                className="h-5 w-5 text-emerald-300"
              />
            </div>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>✓ Full access to all features</li>
              <li>✓ Primary warehouse location</li>
              <li>✓ Priority + Full count modes</li>
              <li>✓ Mobile-first interface</li>
              <li>✓ Email support</li>
            </ul>
            <div className="mt-3 text-xs text-emerald-300 font-medium">
              No credit card required
            </div>
          </div>

          {/* Paid Plan Option */}
          <div 
            className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
              selectedPlan === 'paid' 
                ? 'border-emerald-300 bg-emerald-900/20' 
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
            }`}
            onClick={() => setSelectedPlan('paid')}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-50">Professional</h3>
                <p className="text-sm text-slate-400">Full access</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-50">$50</div>
                <div className="text-sm text-slate-400">per month</div>
              </div>
              <input
                type="radio"
                name="plan"
                value="paid"
                checked={selectedPlan === 'paid'}
                onChange={() => setSelectedPlan('paid')}
                className="h-5 w-5 text-emerald-300"
              />
            </div>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>✓ Everything in trial</li>
              <li>✓ Unlimited usage</li>
              <li>✓ Priority support</li>
              <li>✓ Advanced reporting</li>
              <li>✓ Data export features</li>
            </ul>
            <div className="mt-3 text-xs text-blue-400 font-medium">
              🔥 Most popular choice
            </div>
          </div>
        </div>

        {/* Action Button */}
        {selectedPlan === 'trial' ? (
          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors focus:ring-4 focus:ring-emerald-200 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mr-2"></div>
                Starting Trial...
              </div>
            ) : (
              'Start 14-Day Free Trial'
            )}
          </button>
        ) : (
          <button
            onClick={handleSubscription}
            disabled={loading || !stripe}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors focus:ring-4 focus:ring-emerald-200 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mr-2"></div>
                Setting up Payment...
              </div>
            ) : (
              'Subscribe for $50/month'
            )}
          </button>
        )}

        {/* Features */}
        <div className="mt-6 space-y-4">
          <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-600">
            <h4 className="text-sm font-medium text-blue-400 mb-2">✨ What's Included:</h4>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• Mobile-first counting interface</li>
              <li>• Barcode scanner integration</li>
              <li>• Real-time inventory tracking</li>
              <li>• Secure cloud storage</li>
              <li>• Audit trail & reporting</li>
            </ul>
          </div>

          <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-600">
            <h4 className="text-sm font-medium text-emerald-400 mb-2">🔒 Secure Payment:</h4>
            <ul className="text-xs text-emerald-300 space-y-1">
              <li>• Stripe secure processing</li>
              <li>• Cancel anytime</li>
              <li>• No setup fees</li>
              <li>• 30-day money-back guarantee</li>
            </ul>
          </div>
        </div>

        {/* User Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Setting up for <span className="font-medium text-slate-50">{user?.email}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StripePayment;