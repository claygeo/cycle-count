// frontend/src/components/PaymentCancelled.js - Mobile-First Dark Theme
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PaymentCancelled = () => {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    // Go back to payment selection
    navigate('/payment');
  };

  const handleStartTrial = () => {
    // Start free trial instead
    navigate('/trial');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        {/* Cancel Icon */}
        <div className="w-20 h-20 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-yellow-400 text-4xl">⚠️</span>
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-slate-50 mb-2">Payment Cancelled</h1>
        <p className="text-slate-400 mb-6">
          No worries! Your payment was cancelled and no charges were made.
        </p>

        {/* Options */}
        <div className="space-y-4 mb-6">
          {/* Try Payment Again */}
          <button
            onClick={handleTryAgain}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            Try Payment Again
          </button>

          {/* Start Free Trial */}
          <button
            onClick={handleStartTrial}
            className="w-full bg-gray-700 hover:bg-gray-600 text-slate-50 py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            Start 14-Day Free Trial Instead
          </button>
        </div>

        {/* Why Choose Us */}
        <div className="bg-blue-900/20 rounded-lg p-4 mb-6 text-left border border-blue-600">
          <h3 className="font-semibold text-blue-400 mb-3">💡 Why Inventory Insights?</h3>
          <ul className="text-sm text-blue-300 space-y-2">
            <li className="flex items-center">
              <span className="text-blue-400 mr-2">✓</span>
              Mobile-first design for easy counting
            </li>
            <li className="flex items-center">
              <span className="text-blue-400 mr-2">✓</span>
              Save hours with barcode scanning
            </li>
            <li className="flex items-center">
              <span className="text-blue-400 mr-2">✓</span>
              Real-time inventory tracking
            </li>
            <li className="flex items-center">
              <span className="text-blue-400 mr-2">✓</span>
              Secure cloud storage & backup
            </li>
          </ul>
        </div>

        {/* Trial Benefits */}
        <div className="bg-emerald-900/20 rounded-lg p-4 mb-6 text-left border border-emerald-600">
          <h3 className="font-semibold text-emerald-300 mb-3">🆓 Free Trial Includes:</h3>
          <ul className="text-sm text-emerald-200 space-y-1">
            <li>• Full access to all features for 14 days</li>
            <li>• No credit card required</li>
            <li>• Cancel anytime during trial</li>
            <li>• Email support included</li>
          </ul>
        </div>

        {/* Security Notice */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-400">
            Your payment information is encrypted and secure
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelled;