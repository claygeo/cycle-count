import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { theme, getLocationByCode } from '../config/theme';
import { dashboardAPI } from '../utils/api';

const Overview = ({ userType, selectedLocation, user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await dashboardAPI.getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if current location supports weekly counts
  const supportsWeeklyCount = () => {
    const locationInfo = getLocationByCode(selectedLocation);
    return locationInfo?.supportsWeeklyCount || false;
  };

  const features = [
    {
      title: 'Analytics Dashboard',
      description: 'View inventory trends and insights for your location.',
      path: '/graphs',
      icon: '📊',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Generate Labels',
      description: 'Create barcode labels for new products.',
      path: '/generate-labels',
      icon: '🏷️',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Print Settings',
      description: 'Configure printing options for labels.',
      path: '/print-settings',
      icon: '⚙️',
      color: 'bg-gray-50 text-gray-600',
    },
    {
      title: 'Monthly Count',
      description: 'Perform and review monthly inventory counts.',
      path: '/monthly-count',
      icon: '📋',
      color: 'bg-purple-50 text-purple-600',
    },
    // ✅ FIXED: Now shows weekly count for ALL users (admin and regular) who have locations that support it
    ...(supportsWeeklyCount()
      ? [{
          title: 'Weekly Count',
          description: 'Track weekly counts for high-volume SKUs.',
          path: '/weekly-count',
          icon: '📅',
          color: 'bg-orange-50 text-orange-600',
        }]
      : []),
    {
      title: 'Audit Trail',
      description: 'View a complete history of all actions and changes.',
      path: '/audit-trail',
      icon: '🕒',
      color: 'bg-indigo-50 text-indigo-600',
    },
  ];

  const getPlanColor = (plan) => {
    switch (plan?.toLowerCase()) {
      case 'starter':
        return 'bg-green-100 text-green-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  // Get location name for display
  const getLocationName = () => {
    const locationInfo = getLocationByCode(selectedLocation);
    return locationInfo?.name || selectedLocation;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Welcome to {theme.brandName}
              </h1>
              <p className="text-xl text-gray-600">
                {user?.company_name} • {getLocationName()} • {userType === 'admin' ? 'Administrator' : 'User'}
              </p>
              {/* Show weekly count availability status for all users */}
              <p className="text-sm text-gray-500 mt-1">
                Weekly counting: {supportsWeeklyCount() ? '✅ Available' : '❌ Not available for this location'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Quick Stats */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Plan Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Plan</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanColor(dashboardData.subscription?.plan)}`}>
                      {dashboardData.subscription?.plan || 'Free Trial'}
                    </span>
                  </div>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm">💎</span>
                </div>
              </div>
            </div>

            {/* Labels Usage */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Labels Used</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {dashboardData.usage?.labels_used || 0}
                    <span className="text-sm text-gray-500 font-normal">
                      /{dashboardData.usage?.labels_limit === 'unlimited' ? '∞' : dashboardData.usage?.labels_limit || 0}
                    </span>
                  </p>
                  {dashboardData.usage?.labels_limit !== 'unlimited' && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(
                          getUsagePercentage(dashboardData.usage?.labels_used, dashboardData.usage?.labels_limit)
                        )}`}
                        style={{
                          width: `${getUsagePercentage(dashboardData.usage?.labels_used, dashboardData.usage?.labels_limit)}%`
                        }}
                      ></div>
                    </div>
                  )}
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm">🏷️</span>
                </div>
              </div>
            </div>

            {/* Active Locations */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Locations</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {dashboardData.usage?.locations_used || 1}
                    <span className="text-sm text-gray-500 font-normal">
                      /{dashboardData.usage?.locations_limit === 'unlimited' ? '∞' : dashboardData.usage?.locations_limit || 0}
                    </span>
                  </p>
                </div>
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-sm">📍</span>
                </div>
              </div>
            </div>

            {/* Trial Days Remaining */}
            {dashboardData.subscription?.trial_days_remaining > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Trial Remaining</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      {dashboardData.subscription.trial_days_remaining}
                      <span className="text-sm text-gray-500 font-normal"> days</span>
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 text-sm">⏰</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trial Warning */}
        {dashboardData?.subscription?.trial_days_remaining <= 3 && dashboardData?.subscription?.trial_days_remaining > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-8">
            <div className="flex items-center">
              <div className="w-5 h-5 text-orange-500 mr-3">⚠️</div>
              <div className="flex-1">
                <p className="text-orange-800 font-medium">
                  Your free trial expires in {dashboardData.subscription.trial_days_remaining} days
                </p>
                <p className="text-orange-700 text-sm mt-1">
                  Upgrade your plan to continue using {theme.brandName} without interruption.
                </p>
              </div>
              <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium">
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature) => (
            <Link
              key={feature.title}
              to={feature.path}
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-gray-100 hover:border-blue-200"
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="mt-3 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            {dashboardData?.recent_activity?.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.recent_activity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 py-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-gray-400 text-xl">📝</span>
                </div>
                <p className="text-gray-500 text-sm">No recent activity</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/generate-labels"
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <span className="text-green-600">🏷️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Create Labels</p>
                  <p className="text-sm text-gray-500">Generate new barcode labels</p>
                </div>
              </Link>

              <Link
                to="/monthly-count"
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <span className="text-purple-600">📋</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Start Monthly Count</p>
                  <p className="text-sm text-gray-500">Begin inventory counting</p>
                </div>
              </Link>

              {/* ✅ FIXED: Show weekly count for ALL users (admin and regular) if location supports it */}
              {supportsWeeklyCount() && (
                <Link
                  to="/weekly-count"
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <span className="text-orange-600">📅</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Start Weekly Count</p>
                    <p className="text-sm text-gray-500">Track high-volume SKUs</p>
                  </div>
                </Link>
              )}

              <Link
                to="/graphs"
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-blue-600">📊</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">View Analytics</p>
                  <p className="text-sm text-gray-500">Check inventory insights</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <div className="text-gray-500 text-sm space-y-1">
            <p>{theme.brandName} • {theme.tagline}</p>
            <p>Manage your inventory with ease and precision</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Overview;