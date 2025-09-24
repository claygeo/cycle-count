// frontend/src/components/LocationSelection.js - Simplified Auto-Assignment Version
import React, { useState, useEffect } from 'react';
import { getAvailableLocations, getLocationByCode, userFlows, getDefaultLocation, mobileStyles } from '../config/theme';

const LocationSelection = ({ onLocationSelect, user }) => {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableLocations, setAvailableLocations] = useState([]);

  // ✅ STREAMLINED: Auto-assignment logic
  useEffect(() => {
    try {
      // Check if user should skip location selection
      if (userFlows.skipLocationSelection(user)) {
        console.log('✅ Auto-assigning location for user:', user.email);
        const autoLocation = userFlows.getAutoLocation(user);
        if (autoLocation) {
          console.log('✅ Auto-selected location:', autoLocation);
          // Auto-select and proceed immediately
          onLocationSelect(autoLocation);
          return;
        }
      }

      // Fallback: Show available locations
      const userPlan = user?.plan || 'trial';
      const locations = getAvailableLocations(userPlan);
      setAvailableLocations(locations);
      
      // Auto-select if only one location available
      if (locations.length === 1) {
        setSelectedLocation(locations[0].code);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      setError('Failed to load available locations');
    }
  }, [user, onLocationSelect]);

  // ✅ STREAMLINED: Handle location selection
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedLocation) {
      setError('Please select a location.');
      return;
    }

    const locationInfo = getLocationByCode(selectedLocation);
    if (!locationInfo) {
      setError('Invalid location selected.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      onLocationSelect(selectedLocation);
    } catch (err) {
      setError(`Error selecting location: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPlanName = () => {
    const planNames = {
      trial: '14-Day Trial',
      starter: 'Professional',
      professional: 'Professional'
    };
    return planNames[user?.plan] || 'Trial';
  };

  // ✅ AUTO-ASSIGNMENT: If no locations to show, show loading
  if (availableLocations.length === 0) {
    return (
      <div className={mobileStyles.backgrounds.main}>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-300 font-bold text-xl">I</span>
            </div>
            <div className="w-8 h-8 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Setting Up Location</h2>
            <p className="text-slate-600">Configuring your warehouse automatically...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={mobileStyles.backgrounds.main}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-300 font-bold text-xl">I</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your Location</h1>
            <p className="text-slate-600">
              Choose the warehouse location for inventory counting
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                {getPlanName()}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location Cards */}
            <div className="space-y-3">
              {availableLocations.map((loc) => (
                <label
                  key={loc.code}
                  className={`block cursor-pointer border-2 rounded-xl p-4 transition-all ${
                    selectedLocation === loc.code
                      ? 'border-emerald-300 bg-emerald-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      selectedLocation === loc.code ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      {loc.icon}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                        <input
                          type="radio"
                          name="location"
                          value={loc.code}
                          checked={selectedLocation === loc.code}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{loc.description}</p>
                      <div className="mt-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          selectedLocation === loc.code 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {loc.code}
                        </span>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Error Display */}
            {error && (
              <div className={`p-4 rounded-lg ${mobileStyles.status.error}`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedLocation}
              className={`${mobileStyles.buttons.primary} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Setting up...
                </div>
              ) : (
                'Start Counting'
              )}
            </button>
          </form>

          {/* Features Preview */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-center">
              Ready to Count
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600">📊</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Priority Count</h4>
                  <p className="text-sm text-slate-600">Quick daily counts for high-volume items</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600">📋</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Full Count</h4>
                  <p className="text-sm text-slate-600">Complete monthly inventory counting</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600">📱</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Mobile-First</h4>
                  <p className="text-sm text-slate-600">Optimized for phones and tablets</p>
                </div>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Logged in as <span className="font-medium">{user?.email}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {user?.companyName} • {getPlanName()}
            </p>
          </div>

          {/* System Status */}
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              <span>System Ready • Auto-Setup Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSelection;