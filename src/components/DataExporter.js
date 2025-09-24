// src/components/DataExporter.js - Pure Frontend Data Export
import React, { useState } from 'react';
import { localStorageManager, storageHelpers } from '../utils/LocalStorageManager';

const DataExporter = ({ currentSession }) => {
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeDetails, setIncludeDetails] = useState(true);
  
  // Get session history
  const sessionHistory = localStorageManager.getSessionHistory();

  // Handle session selection
  const handleSessionToggle = (sessionId) => {
    setSelectedSessions(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId);
      } else {
        return [...prev, sessionId];
      }
    });
  };

  // Select all sessions
  const handleSelectAll = () => {
    if (selectedSessions.length === sessionHistory.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(sessionHistory.map(session => session.id));
    }
  };

  // Export current session
  const handleExportCurrent = () => {
    if (!currentSession) return;
    
    try {
      const success = storageHelpers.exportSessionAsCSV();
      if (success) {
        console.log('Current session exported successfully');
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Export selected sessions
  const handleExportSelected = () => {
    if (selectedSessions.length === 0) return;
    
    try {
      // Create combined export data
      const combinedData = {
        exportDate: new Date().toISOString(),
        sessionsCount: selectedSessions.length,
        format: exportFormat,
        includeDetails,
        sessions: []
      };

      selectedSessions.forEach(sessionId => {
        const sessionData = localStorageManager.exportSessionData(sessionId);
        if (sessionData) {
          combinedData.sessions.push(sessionData);
        }
      });

      // Generate CSV content
      let csvContent = '';
      
      if (exportFormat === 'csv') {
        // CSV format
        const headers = [
          'Session ID',
          'Filename', 
          'Upload Date',
          'Status',
          'Total Items',
          'Counted Items',
          'Progress %',
          'SKU',
          'Barcode',
          'Description',
          'Expected Qty',
          'Counted Qty',
          'Variance',
          'Count Status',
          'Count Time',
          'Notes'
        ];

        csvContent = headers.join(',') + '\n';

        combinedData.sessions.forEach(session => {
          const sessionInfo = session.sessionInfo;
          
          session.results.forEach(result => {
            const row = [
              sessionInfo.id,
              `"${sessionInfo.filename || ''}"`,
              new Date(sessionInfo.uploadDate).toLocaleDateString(),
              sessionInfo.status,
              sessionInfo.countProgress?.total || 0,
              sessionInfo.countProgress?.counted || 0,
              sessionInfo.countProgress?.percentage || 0,
              result.sku,
              result.barcode,
              `"${result.description || ''}"`,
              result.expectedQuantity || 0,
              result.countedQuantity || '',
              result.variance || '',
              result.counted ? 'Counted' : 'Not Counted',
              result.countedTime ? new Date(result.countedTime).toLocaleString() : '',
              `"${result.notes || ''}"`
            ];
            
            csvContent += row.join(',') + '\n';
          });
        });
      }

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `inventory_export_${selectedSessions.length}_sessions_${new Date().toISOString().split('T')[0]}.csv`;
      
      storageHelpers.downloadBlob(blob, filename);
      
      console.log(`Exported ${selectedSessions.length} sessions successfully`);
      
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Export all data as JSON backup
  const handleExportBackup = () => {
    try {
      const backupData = {
        exportDate: new Date().toISOString(),
        exportType: 'full_backup',
        version: '1.0',
        currentSession: localStorageManager.getCurrentSession(),
        sessionHistory: localStorageManager.getSessionHistory(),
        appState: localStorageManager.getAppState(),
        userPreferences: localStorageManager.getUserPreferences()
      };

      const jsonContent = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const filename = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      storageHelpers.downloadBlob(blob, filename);
      
      console.log('Full backup exported successfully');
      
    } catch (error) {
      console.error('Backup export error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Session Export */}
      {currentSession && (
        <div 
          className="rounded-xl p-6 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#FAFCFB' }}>
            Current Session
          </h3>
          
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#15161B' }}>
            <div>
              <div className="font-medium" style={{ color: '#FAFCFB' }}>
                {currentSession.uploadData?.filename || 'Unknown'}
              </div>
              <div className="text-sm" style={{ color: '#9FA3AC' }}>
                {currentSession.countProgress.counted} / {currentSession.countProgress.total} items counted
                ({currentSession.countProgress.percentage}%)
              </div>
            </div>
            
            <button
              onClick={handleExportCurrent}
              className="px-4 py-2 rounded-lg font-medium"
              style={{ 
                backgroundColor: '#86EFAC', 
                color: '#00001C'
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {/* Session History Export */}
      <div 
        className="rounded-xl p-6 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#FAFCFB' }}>
            Session History ({sessionHistory.length})
          </h3>
          
          {sessionHistory.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium"
              style={{ color: '#86EFAC' }}
            >
              {selectedSessions.length === sessionHistory.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {sessionHistory.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
            <div>No completed sessions to export</div>
            <div className="text-sm mt-1">Complete a count session first</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sessionHistory.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedSessions.includes(session.id) 
                    ? 'bg-emerald-900/20 border-emerald-400' 
                    : 'hover:bg-gray-800'
                }`}
                style={{ 
                  backgroundColor: selectedSessions.includes(session.id) ? '#86EFAC20' : '#15161B',
                  borderColor: selectedSessions.includes(session.id) ? '#86EFAC' : '#39414E'
                }}
                onClick={() => handleSessionToggle(session.id)}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSessions.includes(session.id)}
                    onChange={() => handleSessionToggle(session.id)}
                    className="mr-3"
                    style={{ accentColor: '#86EFAC' }}
                  />
                  
                  <div>
                    <div className="font-medium" style={{ color: '#FAFCFB' }}>
                      {session.uploadData?.filename || 'Unknown'}
                    </div>
                    <div className="text-sm" style={{ color: '#9FA3AC' }}>
                      {new Date(session.uploadDate).toLocaleDateString()} • 
                      {session.countProgress.counted} / {session.countProgress.total} items • 
                      {session.status === 'completed' ? 'Completed' : 'In Progress'}
                    </div>
                  </div>
                </div>
                
                <div className="text-sm" style={{ 
                  color: session.status === 'completed' ? '#86EFAC' : '#F59E0B' 
                }}>
                  {session.countProgress.percentage}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Options */}
      {(selectedSessions.length > 0 || sessionHistory.length > 0) && (
        <div 
          className="rounded-xl p-6 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#FAFCFB' }}>
            Export Options
          </h3>
          
          <div className="space-y-4">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#FAFCFB' }}>
                Export Format
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="mr-2"
                    style={{ accentColor: '#86EFAC' }}
                  />
                  <span style={{ color: '#9FA3AC' }}>CSV (Excel compatible)</span>
                </label>
              </div>
            </div>

            {/* Include Details */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeDetails}
                  onChange={(e) => setIncludeDetails(e.target.checked)}
                  className="mr-2"
                  style={{ accentColor: '#86EFAC' }}
                />
                <span className="text-sm font-medium" style={{ color: '#FAFCFB' }}>
                  Include detailed item information
                </span>
              </label>
              <p className="text-xs mt-1" style={{ color: '#9FA3AC' }}>
                Includes descriptions, expected quantities, and variance calculations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Export Selected */}
        <button
          onClick={handleExportSelected}
          disabled={selectedSessions.length === 0}
          className="py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ 
            backgroundColor: selectedSessions.length > 0 ? '#86EFAC' : '#39414E',
            color: selectedSessions.length > 0 ? '#00001C' : '#9FA3AC'
          }}
        >
          Export Selected ({selectedSessions.length})
        </button>

        {/* Export All as CSV */}
        <button
          onClick={() => {
            setSelectedSessions(sessionHistory.map(s => s.id));
            setTimeout(handleExportSelected, 100);
          }}
          disabled={sessionHistory.length === 0}
          className="py-3 px-4 rounded-lg font-medium border transition-colors disabled:opacity-50"
          style={{ 
            backgroundColor: 'transparent',
            color: sessionHistory.length > 0 ? '#86EFAC' : '#9FA3AC',
            borderColor: sessionHistory.length > 0 ? '#86EFAC' : '#39414E'
          }}
        >
          Export All Sessions
        </button>

        {/* Full Backup */}
        <button
          onClick={handleExportBackup}
          className="py-3 px-4 rounded-lg font-medium border transition-colors"
          style={{ 
            backgroundColor: 'transparent',
            color: '#F59E0B',
            borderColor: '#F59E0B'
          }}
        >
          Full Data Backup (JSON)
        </button>
      </div>

      {/* Export Info */}
      <div 
        className="rounded-lg p-4"
        style={{ 
          backgroundColor: '#F3F4F6',
          color: '#374151'
        }}
      >
        <h4 className="font-medium mb-2">Export Information</h4>
        <ul className="text-sm space-y-1">
          <li>• <strong>CSV Export:</strong> Excel-compatible format with count results and variance analysis</li>
          <li>• <strong>Current Session:</strong> Exports your active counting session (including partial progress)</li>
          <li>• <strong>Selected Sessions:</strong> Combines multiple completed sessions into one export file</li>
          <li>• <strong>Full Backup:</strong> JSON format containing all app data for backup/restore purposes</li>
        </ul>
      </div>
    </div>
  );
};

export default DataExporter;