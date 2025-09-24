// src/App.js - Pure Frontend Application (No Backend/Authentication)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import CountSession from './components/CountSession';
import CSVUploadComponent from './components/CSVUploadComponent';
import DataExporter from './components/DataExporter';
import ErrorBoundary from './components/ErrorBoundary';
import { localStorageManager } from './utils/LocalStorageManager';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentSession, setCurrentSession] = useState(null);
  const [appStats, setAppStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize app and load existing session
  useEffect(() => {
    try {
      console.log('Initializing pure frontend app...');
      
      // Check for existing session
      const existingSession = localStorageManager.getCurrentSession();
      if (existingSession) {
        setCurrentSession(existingSession);
        console.log('Found existing session:', existingSession.id);
      }
      
      // Load app statistics
      const stats = localStorageManager.getDashboardStats();
      setAppStats(stats);
      
      setLoading(false);
    } catch (error) {
      console.error('Error initializing app:', error);
      setError('Failed to initialize application');
      setLoading(false);
    }
  }, []);

  // Refresh app statistics
  const refreshStats = () => {
    try {
      const session = localStorageManager.getCurrentSession();
      const stats = localStorageManager.getDashboardStats();
      
      setCurrentSession(session);
      setAppStats(stats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
      setError('Failed to refresh data');
    }
  };

  // Handle CSV upload success
  const handleCSVUploadSuccess = (filename, csvData) => {
    try {
      console.log('Processing CSV upload:', filename, csvData.length, 'items');
      
      const result = localStorageManager.processCSVUpload(filename, csvData);
      
      if (result.success) {
        setCurrentSession(result.session);
        setCurrentView('count-session');
        setError('');
        
        console.log(`CSV processed: ${result.processed} items, ${result.skipped} skipped`);
      } else {
        setError(result.error || 'Failed to process CSV');
      }
      
      refreshStats();
    } catch (error) {
      console.error('CSV upload error:', error);
      setError(error.message || 'Failed to upload CSV');
    }
  };

  // Handle CSV upload error
  const handleCSVUploadError = (errorMessage) => {
    setError(errorMessage);
  };

  // Handle count completion
  const handleCountComplete = () => {
    try {
      const completedSession = localStorageManager.completeSession();
      
      if (completedSession) {
        console.log('Count session completed:', completedSession.id);
        setCurrentSession(null);
        setCurrentView('dashboard');
        refreshStats();
      }
    } catch (error) {
      console.error('Error completing count:', error);
      setError('Failed to complete count session');
    }
  };

  // Handle session cancellation
  const handleCancelSession = () => {
    if (window.confirm('Are you sure you want to cancel this count session? All progress will be lost.')) {
      try {
        localStorageManager.clearCurrentSession();
        setCurrentSession(null);
        setCurrentView('dashboard');
        refreshStats();
      } catch (error) {
        console.error('Error canceling session:', error);
        setError('Failed to cancel session');
      }
    }
  };

  // Handle new session start
  const handleStartNewSession = () => {
    if (currentSession && currentSession.skus && currentSession.skus.length > 0) {
      if (!window.confirm('Starting a new session will replace your current progress. Continue?')) {
        return;
      }
    }
    
    setCurrentView('upload');
    setError('');
  };

  // Navigation handlers
  const goToDashboard = () => {
    setCurrentView('dashboard');
    setError('');
  };

  const goToUpload = () => {
    setCurrentView('upload');
    setError('');
  };

  const goToExport = () => {
    setCurrentView('export');
    setError('');
  };

  const continueCounting = () => {
    if (currentSession) {
      setCurrentView('count-session');
      setError('');
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-300 font-bold text-xl">I</span>
          </div>
          <div className="w-8 h-8 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading Inventory Insights...</p>
          <p className="text-emerald-300 text-sm mt-2">Pure Frontend Mode</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && !currentView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="App min-h-screen" style={{ backgroundColor: '#15161B' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#181B22' }} className="shadow-sm border-b border-gray-700">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold" style={{ color: '#FAFCFB' }}>
                  Inventory Insights
                  <span className="ml-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: '#86EFAC', color: '#00001C' }}>
                    FRONTEND
                  </span>
                </h1>
                
                {/* Navigation */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToDashboard}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentView === 'dashboard' 
                        ? 'bg-emerald-300 text-gray-900' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Dashboard
                  </button>
                  
                  <button
                    onClick={goToUpload}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentView === 'upload' 
                        ? 'bg-emerald-300 text-gray-900' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Upload CSV
                  </button>
                  
                  <button
                    onClick={goToExport}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentView === 'export' 
                        ? 'bg-emerald-300 text-gray-900' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Global Error Message */}
          {error && (
            <div className="px-4 py-3">
              <div className="rounded-lg p-4 border" style={{ 
                backgroundColor: '#FEE2E2', 
                borderColor: '#F87171',
                color: '#B91C1C'
              }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{error}</span>
                  <button
                    onClick={() => setError('')}
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: '#F87171', color: 'white' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1">
            <Routes>
              <Route path="*" element={
                <>
                  {currentView === 'dashboard' && (
                    <Dashboard
                      currentSession={currentSession}
                      appStats={appStats}
                      onStartNewSession={handleStartNewSession}
                      onContinueCounting={continueCounting}
                      onRefresh={refreshStats}
                    />
                  )}

                  {currentView === 'upload' && (
                    <div className="px-4 py-6">
                      <div className="max-w-4xl mx-auto">
                        <div className="mb-6">
                          <h2 className="text-2xl font-bold mb-2" style={{ color: '#FAFCFB' }}>
                            Upload Inventory CSV
                          </h2>
                          <p style={{ color: '#9FA3AC' }}>
                            Upload your inventory CSV file to start a new count session
                          </p>
                        </div>
                        
                        <CSVUploadComponent
                          onUploadSuccess={handleCSVUploadSuccess}
                          onUploadError={handleCSVUploadError}
                          existingSession={currentSession}
                        />
                      </div>
                    </div>
                  )}

                  {currentView === 'count-session' && currentSession && (
                    <CountSession
                      session={currentSession}
                      onCountComplete={handleCountComplete}
                      onCancelSession={handleCancelSession}
                      onBack={goToDashboard}
                    />
                  )}

                  {currentView === 'export' && (
                    <div className="px-4 py-6">
                      <div className="max-w-4xl mx-auto">
                        <div className="mb-6">
                          <h2 className="text-2xl font-bold mb-2" style={{ color: '#FAFCFB' }}>
                            Export Data
                          </h2>
                          <p style={{ color: '#9FA3AC' }}>
                            Export your count sessions and results
                          </p>
                        </div>
                        
                        <DataExporter
                          currentSession={currentSession}
                        />
                      </div>
                    </div>
                  )}
                </>
              } />
            </Routes>
          </div>

          {/* Footer */}
          <div 
            className="border-t text-center py-4"
            style={{ 
              backgroundColor: '#181B22', 
              borderColor: '#39414E',
              color: '#9FA3AC' 
            }}
          >
            <div className="text-xs space-y-1">
              <div>Inventory Insights - Pure Frontend Mode</div>
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#86EFAC' }}
                  ></span>
                  <span>Local Storage Active</span>
                </div>
                {currentSession && (
                  <div className="flex items-center space-x-1">
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#86EFAC' }}
                    ></span>
                    <span>Count Session Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;