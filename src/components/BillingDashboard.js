import React, { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import { billingAPI } from '../utils/api';

const BillingDashboard = () => {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const [subData, historyData] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getBillingHistory()
      ]);
      
      setSubscription(subData.subscription);
      setUsage(subData.usage);
      setBillingHistory(historyData.history || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (planId) => {
    try {
      setLoading(true);
      await billingAPI.updateSubscription(planId);
      await fetchBillingData();
      setShowPlans(false);
    } catch (error) {
      setError('Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await billingAPI.cancelSubscription();
      await fetchBillingData();
    } catch (error) {
      setError('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan) => {
    switch (plan?.toLowerCase()) {
      case 'starter':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'professional':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUsagePercentage = (used, limit) => {
    if (!limit || limit === 'unlimited') return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading && !subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
            <p className="text-gray-600 mt-1">Manage your subscription and track usage</p>
          </div>
          <button
            onClick={() => setShowPlans(!showPlans)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            {showPlans ? 'Hide Plans' : 'Change Plan'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Current Subscription */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>
          
          {subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPlanColor(subscription.plan)}`}>
                    {subscription.plan} Plan
                  </span>
                  {subscription.status === 'trial' && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      Free Trial
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900">{theme.plans[subscription.plan?.toLowerCase()]?.price || '$0'}</p>
                <p className="text-gray-600">per month</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Plan Features</h3>
                <ul className="space-y-1">
                  {theme.plans[subscription.plan?.toLowerCase()]?.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Billing Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${subscription.status === 'active' ? 'text-green-600' : subscription.status === 'trial' ? 'text-orange-600' : 'text-red-600'}`}>
                      {subscription.status === 'trial' ? 'Free Trial' : subscription.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Next billing:</span>
                    <span className="font-medium text-gray-900">
                      {subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  {subscription.trial_ends_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trial ends:</span>
                      <span className="font-medium text-orange-600">
                        {new Date(subscription.trial_ends_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No active subscription</p>
            </div>
          )}
        </div>

        {/* Usage Statistics */}
        {usage && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage This Month</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Labels Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Labels Generated</h3>
                  <span className="text-sm text-gray-600">
                    {usage.labels_used}/{usage.labels_limit === 'unlimited' ? '∞' : usage.labels_limit}
                  </span>
                </div>
                {usage.labels_limit !== 'unlimited' && (
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${getUsageColor(
                        getUsagePercentage(usage.labels_used, usage.labels_limit)
                      )}`}
                      style={{
                        width: `${getUsagePercentage(usage.labels_used, usage.labels_limit)}%`
                      }}
                    ></div>
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  {usage.labels_limit !== 'unlimited' && getUsagePercentage(usage.labels_used, usage.labels_limit) > 90 && (
                    <span className="text-red-600">Approaching limit</span>
                  )}
                </p>
              </div>

              {/* Locations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Active Locations</h3>
                  <span className="text-sm text-gray-600">
                    {usage.locations_used}/{usage.locations_limit === 'unlimited' ? '∞' : usage.locations_limit}
                  </span>
                </div>
                <div className="space-y-1">
                  {usage.active_locations?.map((location, index) => (
                    <div key={index} className="text-sm text-gray-600 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {location}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Members */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Team Members</h3>
                  <span className="text-sm text-gray-600">
                    {usage.users_count}/{usage.users_limit === 'unlimited' ? '∞' : usage.users_limit}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {usage.users_count} active team members
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plan Comparison */}
        {showPlans && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose Your Plan</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(theme.plans).map(([planId, plan]) => (
                <div
                  key={planId}
                  className={`border-2 rounded-xl p-6 relative ${
                    subscription?.plan?.toLowerCase() === planId
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  } ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{plan.price}</p>
                    <p className="text-gray-600">per month</p>
                    <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => handlePlanChange(planId)}
                    disabled={subscription?.plan?.toLowerCase() === planId || loading}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      subscription?.plan?.toLowerCase() === planId
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {subscription?.plan?.toLowerCase() === planId ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing History */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Billing History</h2>
          
          {billingHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-600">Description</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-600">Amount</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-600">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-900">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="py-3 text-sm text-gray-900">${item.amount}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'paid' ? 'bg-green-100 text-green-800' :
                          item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {item.invoice_url && (
                          <a 
                            href={item.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No billing history available</p>
            </div>
          )}
        </div>

        {/* Cancel Subscription */}
        {subscription?.status === 'active' && (
          <div className="mt-6 text-center">
            <button
              onClick={handleCancelSubscription}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Cancel Subscription
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingDashboard;