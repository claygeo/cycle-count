// src/components/Dashboard.js - Pure Frontend Dashboard (Updated)
import React from 'react';
import { DateTime } from 'luxon';
import { localStorageManager, storageHelpers } from '../utils/LocalStorageManager';

const Dashboard = ({ currentSession, appStats, onStartNewSession, onContinueCounting, onRefresh }) => {
  // Get current statistics
  const sessionStats = currentSession ? localStorageManager.getCountStatistics() : null;
  
  // Format time helper
  const getCurrentTimeEST = () => {
    return DateTime.now().setZone('America/New_York').toFormat('HH:mm');
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Current Session Status */}
      {currentSession ? (
        <div 
          className="rounded-xl p-6 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: '#FAFCFB' }}>
              Active Count Session
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C' 
            }}>
              IN PROGRESS
            </span>
          </div>
          
          <div className="space-y-4">
            {/* Session Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm" style={{ color: '#9FA3AC' }}>Filename</div>
                <div className="font-medium" style={{ color: '#FAFCFB' }}>
                  {currentSession.uploadData?.filename || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#9FA3AC' }}>Upload Date</div>
                <div className="font-medium" style={{ color: '#FAFCFB' }}>
                  {new Date(currentSession.uploadDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: '#9FA3AC' }}>Time Spent</div>
                <div className="font-medium" style={{ color: '#FAFCFB' }}>
                  {sessionStats ? storageHelpers.formatTime(sessionStats.timeSpent) : '0s'}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: '#9FA3AC' }}>Progress</span>
                <span className="text-sm font-medium" style={{ color: '#FAFCFB' }}>
                  {sessionStats ? `${sessionStats.counted}/${sessionStats.total} (${sessionStats.percentage}%)` : '0/0 (0%)'}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="h-3 rounded-full transition-all duration-300"
                  style={{ 
                    backgroundColor: '#86EFAC',
                    width: `${sessionStats ? sessionStats.percentage : 0}%` 
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onContinueCounting}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C'
                }}
              >
                Continue Counting
              </button>
              
              <button
                onClick={onStartNewSession}
                className="px-4 py-3 rounded-lg font-medium transition-colors border"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: '#86EFAC',
                  borderColor: '#86EFAC'
                }}
              >
                New Session
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* No Active Session */
        <div 
          className="rounded-xl p-6 shadow-sm border text-center"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: '#FAFCFB' }}>
                No Active Count Session
              </h2>
              <p style={{ color: '#9FA3AC' }}>
                Upload a CSV file to start counting your inventory
              </p>
            </div>
            
            <button
              onClick={onStartNewSession}
              className="px-6 py-3 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: '#86EFAC', 
                color: '#00001C'
              }}
            >
              Start New Count Session
            </button>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className="rounded-xl p-4 shadow-sm border text-center"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: '#FAFCFB' }}>
            {sessionStats ? sessionStats.total : (appStats?.currentSession?.progress?.total || 0)}
          </div>
          <div className="text-sm" style={{ color: '#9FA3AC' }}>
            Total SKUs
          </div>
        </div>
        
        <div 
          className="rounded-xl p-4 shadow-sm border text-center"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: '#FAFCFB' }}>
            {sessionStats ? sessionStats.counted : (appStats?.currentSession?.progress?.counted || 0)}
          </div>
          <div className="text-sm" style={{ color: '#9FA3AC' }}>
            Counted
          </div>
        </div>
        
        <div 
          className="rounded-xl p-4 shadow-sm border text-center"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: '#FAFCFB' }}>
            {sessionStats ? sessionStats.remaining : (appStats?.currentSession?.progress?.remaining || 0)}
          </div>
          <div className="text-sm" style={{ color: '#9FA3AC' }}>
            Remaining
          </div>
        </div>
        
        <div 
          className="rounded-xl p-4 shadow-sm border text-center"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="text-2xl font-bold mb-1" style={{ color: '#FAFCFB' }}>
            {sessionStats ? sessionStats.percentage : (appStats?.currentSession?.progress?.percentage || 0)}%
          </div>
          <div className="text-sm" style={{ color: '#9FA3AC' }}>
            Complete
          </div>
        </div>
      </div>

      {/* Session History */}
      <div 
        className="rounded-xl p-6 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#FAFCFB' }}>
            Session History
          </h3>
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: '#374051', 
              color: '#FAFCFB'
            }}
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#15161B' }}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: '#FAFCFB' }}>
              {appStats?.history?.totalSessions || 0}
            </div>
            <div className="text-sm" style={{ color: '#9FA3AC' }}>
              Completed Sessions
            </div>
          </div>
          
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: '#15161B' }}
          >
            <div className="text-sm mb-1" style={{ color: '#9FA3AC' }}>
              Last Completed
            </div>
            <div className="font-medium" style={{ color: '#FAFCFB' }}>
              {appStats?.history?.lastCompletedSession ? 
                new Date(appStats.history.lastCompletedSession.uploadDate).toLocaleDateString() : 
                'None'
              }
            </div>
          </div>
        </div>

        {/* Recent Sessions List */}
        <RecentSessionsList />
      </div>

      {/* Quick Actions */}
      <div 
        className="rounded-xl p-6 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#FAFCFB' }}>
          Quick Actions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => storageHelpers.exportSessionAsCSV()}
            disabled={!currentSession}
            className="p-4 rounded-lg text-left transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: currentSession ? '#15161B' : '#2D3748',
              color: '#FAFCFB',
              cursor: currentSession ? 'pointer' : 'not-allowed'
            }}
          >
            <div className="text-sm font-medium mb-1">Export Current</div>
            <div className="text-xs" style={{ color: '#9FA3AC' }}>
              Download current session as CSV
            </div>
          </button>
          
          <button
            onClick={() => localStorageManager.cleanupOldData()}
            className="p-4 rounded-lg text-left transition-colors hover:bg-gray-700"
            style={{ 
              backgroundColor: '#15161B',
              color: '#FAFCFB'
            }}
          >
            <div className="text-sm font-medium mb-1">Clean Old Data</div>
            <div className="text-xs" style={{ color: '#9FA3AC' }}>
              Remove sessions older than 30 days
            </div>
          </button>
          
          <button
            onClick={() => {
              if (window.confirm('This will clear all data including current session. Continue?')) {
                localStorageManager.clearAllData();
                window.location.reload();
              }
            }}
            className="p-4 rounded-lg text-left transition-colors hover:bg-red-800"
            style={{ 
              backgroundColor: '#7F1D1D',
              color: '#FAFCFB'
            }}
          >
            <div className="text-sm font-medium mb-1">Reset All Data</div>
            <div className="text-xs" style={{ color: '#FCA5A5' }}>
              Clear all sessions and data
            </div>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div 
        className="rounded-xl p-4 shadow-sm border text-center"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="text-xs space-y-1" style={{ color: '#9FA3AC' }}>
          <div>Last updated: {getCurrentTimeEST()} EST</div>
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-1">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#86EFAC' }}
              ></span>
              <span>LocalStorage Active</span>
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
            <div className="flex items-center space-x-1">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#86EFAC' }}
              ></span>
              <span>Frontend Mode</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Recent Sessions Component
const RecentSessionsList = () => {
  const sessionHistory = localStorageManager.getSessionHistory();
  const recentSessions = sessionHistory.slice(0, 5); // Show last 5 sessions

  if (recentSessions.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
        <div>No completed sessions yet</div>
        <div className="text-sm mt-1">Complete your first count to see history</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium mb-3" style={{ color: '#FAFCFB' }}>
        Recent Sessions
      </h4>
      {recentSessions.map((session, index) => (
        <div
          key={session.id}
          className="flex items-center justify-between p-3 rounded-lg"
          style={{ backgroundColor: '#15161B' }}
        >
          <div className="flex-1">
            <div className="font-medium text-sm" style={{ color: '#FAFCFB' }}>
              {session.uploadData?.filename || 'Unknown'}
            </div>
            <div className="text-xs" style={{ color: '#9FA3AC' }}>
              {new Date(session.uploadDate).toLocaleDateString()} • 
              {session.countProgress.counted}/{session.countProgress.total} items • 
              {storageHelpers.formatTime(session.countProgress.timeSpent || 0)}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium" style={{ 
              color: session.status === 'completed' ? '#86EFAC' : '#F59E0B' 
            }}>
              {session.countProgress.percentage}%
            </div>
            <div className="text-xs" style={{ color: '#9FA3AC' }}>
              {session.status === 'completed' ? 'Complete' : 'Partial'}
            </div>
          </div>
        </div>
      ))}
      
      {sessionHistory.length > 5 && (
        <div className="text-center pt-2">
          <div className="text-xs" style={{ color: '#9FA3AC' }}>
            {sessionHistory.length - 5} more sessions in history
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;