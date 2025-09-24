import React, { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { auditTrailAPI, utils } from '../utils/api';

const AuditTrail = ({ selectedLocation, user }) => {
  const [auditData, setAuditData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    sku: '',
    startDate: '',
    endDate: ''
  });

  const itemsPerPage = 20;

  // ✅ SIMPLIFIED: Fetch audit data
  const fetchAuditData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      if (!utils.isAuthenticated()) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const filterParams = {
        location: selectedLocation,
        limit: 100 // Get recent 100 entries
      };

      const data = await auditTrailAPI.getAuditTrail(filterParams);
      
      if (!data || data.length === 0) {
        setAuditData([]);
        setFilteredData([]);
        return;
      }

      // ✅ SIMPLIFIED: Transform data for display
      const transformedData = data.map((entry) => {
        let action = 'System Action';
        let icon = '⚙️';
        let details = entry.source || 'Unknown action';
        let actionType = 'system';

        // Determine action type and icon
        if (entry.sku && !entry.sku.includes('_')) {
          action = 'Item Count';
          icon = '📦';
          details = `${entry.sku}: Qty ${entry.quantity}`;
          actionType = 'count';
        } else if (entry.source?.includes('auth')) {
          action = 'Login';
          icon = '🔐';
          details = 'User authentication';
          actionType = 'auth';
        } else if (entry.source?.includes('reset')) {
          action = 'Count Reset';
          icon = '🔄';
          details = 'Count data reset';
          actionType = 'reset';
        } else if (entry.source?.includes('start')) {
          action = 'Count Started';
          icon = '▶️';
          details = 'Count session started';
          actionType = 'start';
        }

        return {
          id: entry.id || Math.random(),
          timestamp: entry.timestamp || entry.created_at,
          action,
          actionType,
          sku: entry.sku === 'UNKNOWN' || entry.sku.includes('_') ? '-' : entry.sku,
          details,
          user: entry.user_name || 'System',
          icon,
          location: entry.location,
          quantity: entry.quantity,
          metadata: entry.metadata || {}
        };
      });

      // Sort by timestamp (most recent first)
      transformedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setAuditData(transformedData);
      setFilteredData(transformedData);

    } catch (error) {
      console.error('Error fetching audit data:', error);
      setError(`Failed to load audit data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  // ✅ SIMPLIFIED: Apply filters
  const applyFilters = useCallback(() => {
    let result = [...auditData];

    if (filters.action) {
      result = result.filter(entry => 
        entry.action.toLowerCase().includes(filters.action.toLowerCase())
      );
    }
    
    if (filters.sku) {
      result = result.filter(entry => 
        entry.sku.toLowerCase().includes(filters.sku.toLowerCase())
      );
    }
    
    if (filters.startDate) {
      const start = DateTime.fromISO(filters.startDate).startOf('day');
      result = result.filter(entry => 
        DateTime.fromISO(entry.timestamp) >= start
      );
    }
    
    if (filters.endDate) {
      const end = DateTime.fromISO(filters.endDate).endOf('day');
      result = result.filter(entry => 
        DateTime.fromISO(entry.timestamp) <= end
      );
    }

    setFilteredData(result);
    setCurrentPage(1);
  }, [auditData, filters]);

  useEffect(() => {
    if (user) {
      fetchAuditData();
    }
  }, [fetchAuditData, user]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ✅ MOBILE-FIRST: Clear filters
  const clearFilters = () => {
    setFilters({
      action: '',
      sku: '',
      startDate: '',
      endDate: ''
    });
  };

  // ✅ MOBILE-FIRST: Refresh data
  const handleRefresh = useCallback(async () => {
    await fetchAuditData();
  }, [fetchAuditData]);

  // ✅ MOBILE-FIRST: Format timestamp for mobile with EST
  const formatTimestamp = (timestamp) => {
    try {
      const dt = DateTime.fromISO(timestamp).setZone('America/New_York');
      const now = DateTime.now().setZone('America/New_York');
      
      if (dt.hasSame(now, 'day')) {
        return dt.toFormat('HH:mm');
      } else if (dt.hasSame(now, 'week')) {
        return dt.toFormat('ccc HH:mm');
      } else {
        return dt.toFormat('MM/dd HH:mm');
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  // ✅ MOBILE-FIRST: Get action color - Updated for dark theme
  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'count': return '#86EFAC';
      case 'auth': return '#60A5FA';
      case 'reset': return '#FB923C';
      case 'start': return '#A78BFA';
      default: return '#9FA3AC';
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#15161B' }}>
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#181B22' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#86EFAC' }}></div>
          <p style={{ color: '#9FA3AC' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#15161B' }}>
      {/* ✅ MOBILE-FIRST: Header - Dark theme */}
      <div className="shadow-sm sticky top-0 z-10" style={{ backgroundColor: '#181B22' }}>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#FAFCFB' }}>Activity</h1>
              <p className="text-sm" style={{ color: '#9FA3AC' }}>{selectedLocation}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#39414E', color: '#86EFAC' }}
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ✅ MOBILE-FIRST: Error Display - Dark theme */}
        {error && (
          <div className="rounded-lg p-4 border" style={{ backgroundColor: '#7F1D1D', borderColor: '#DC2626' }}>
            <div className="flex items-center">
              <span className="mr-2" style={{ color: '#FCA5A5' }}>❌</span>
              <div style={{ color: '#FCA5A5' }}>
                <p className="font-medium text-sm">Error Loading Data</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ MOBILE-FIRST: Filters - Dark theme */}
        <div className="rounded-xl p-4" style={{ backgroundColor: '#181B22' }}>
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer">
              <span className="font-medium" style={{ color: '#FAFCFB' }}>Filters</span>
              <span className="group-open:rotate-180 transition-transform" style={{ color: '#9FA3AC' }}>▼</span>
            </summary>
            
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <select
                  value={filters.action}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full p-2 rounded-lg text-sm"
                  style={{ 
                    backgroundColor: '#39414E', 
                    borderColor: '#6B7280', 
                    color: '#FAFCFB',
                    border: '1px solid #6B7280'
                  }}
                >
                  <option value="">All Actions</option>
                  <option value="Item Count">Item Count</option>
                  <option value="Login">Login</option>
                  <option value="Count Reset">Count Reset</option>
                  <option value="Count Started">Count Started</option>
                </select>
                
                <input
                  type="text"
                  value={filters.sku}
                  onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Filter by SKU..."
                  className="w-full p-2 rounded-lg text-sm"
                  style={{ 
                    backgroundColor: '#39414E', 
                    borderColor: '#6B7280', 
                    color: '#FAFCFB',
                    border: '1px solid #6B7280'
                  }}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full p-2 rounded-lg text-sm"
                    style={{ 
                      backgroundColor: '#39414E', 
                      borderColor: '#6B7280', 
                      color: '#FAFCFB',
                      border: '1px solid #6B7280'
                    }}
                  />
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full p-2 rounded-lg text-sm"
                    style={{ 
                      backgroundColor: '#39414E', 
                      borderColor: '#6B7280', 
                      color: '#FAFCFB',
                      border: '1px solid #6B7280'
                    }}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{ backgroundColor: '#6B7280', color: '#FAFCFB' }}
                >
                  Clear
                </button>
                <span className="text-xs" style={{ color: '#9FA3AC' }}>
                  {filteredData.length} of {auditData.length} entries
                </span>
              </div>
            </div>
          </details>
        </div>

        {loading ? (
          /* ✅ MOBILE-FIRST: Loading State - Dark theme */
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#86EFAC' }}></div>
            <p style={{ color: '#9FA3AC' }}>Loading audit trail...</p>
          </div>
        ) : filteredData.length === 0 ? (
          /* ✅ MOBILE-FIRST: Empty State - Dark theme */
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#181B22' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#39414E' }}>
              <span className="text-2xl" style={{ color: '#9FA3AC' }}>📝</span>
            </div>
            <p className="font-medium mb-2" style={{ color: '#FAFCFB' }}>No audit entries found</p>
            <p className="text-sm" style={{ color: '#9FA3AC' }}>
              {auditData.length === 0 
                ? "Start counting items to see audit entries"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          /* ✅ MOBILE-FIRST: Audit Entries - Dark theme */
          <>
            <div className="space-y-3">
              {currentItems.map((entry) => (
                <div key={entry.id} className="rounded-lg p-4 shadow-sm" style={{ backgroundColor: '#181B22' }}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <span className="text-lg">{entry.icon}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" style={{ color: getActionColor(entry.actionType) }}>
                          {entry.action}
                        </span>
                        <span className="text-xs" style={{ color: '#9FA3AC' }}>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm mt-1 truncate" style={{ color: '#9FA3AC' }}>
                        {entry.details}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          {entry.sku !== '-' && (
                            <span className="text-xs px-2 py-1 rounded font-mono" style={{ backgroundColor: '#39414E', color: '#FAFCFB' }}>
                              {entry.sku}
                            </span>
                          )}
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#1E40AF', color: '#DBEAFE' }}>
                            {entry.user}
                          </span>
                        </div>
                        
                        {entry.quantity > 0 && (
                          <span className="text-xs" style={{ color: '#9FA3AC' }}>
                            Qty: {entry.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ MOBILE-FIRST: Pagination - Dark theme */}
            {totalPages > 1 && (
              <div className="rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: '#181B22' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg disabled:cursor-not-allowed text-sm font-medium transition-opacity"
                  style={{ 
                    backgroundColor: currentPage === 1 ? '#6B7280' : '#86EFAC',
                    color: currentPage === 1 ? '#9FA3AC' : '#00001C'
                  }}
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-2 text-sm" style={{ color: '#9FA3AC' }}>
                  <span>Page {currentPage} of {totalPages}</span>
                  <span>•</span>
                  <span>{filteredData.length} entries</span>
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg disabled:cursor-not-allowed text-sm font-medium transition-opacity"
                  style={{ 
                    backgroundColor: currentPage === totalPages ? '#6B7280' : '#86EFAC',
                    color: currentPage === totalPages ? '#9FA3AC' : '#00001C'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ✅ MOBILE-FIRST: Summary Stats - Dark theme */}
        {auditData.length > 0 && (
          <div className="rounded-xl p-4" style={{ backgroundColor: '#181B22' }}>
            <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#86EFAC' }}>
                  {auditData.filter(e => e.actionType === 'count').length}
                </div>
                <div className="text-xs" style={{ color: '#9FA3AC' }}>Item Counts</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#60A5FA' }}>
                  {auditData.filter(e => e.actionType === 'auth').length}
                </div>
                <div className="text-xs" style={{ color: '#9FA3AC' }}>Logins</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#FB923C' }}>
                  {auditData.filter(e => e.actionType === 'reset').length}
                </div>
                <div className="text-xs" style={{ color: '#9FA3AC' }}>Resets</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: '#A78BFA' }}>
                  {auditData.filter(e => e.actionType === 'start').length}
                </div>
                <div className="text-xs" style={{ color: '#9FA3AC' }}>Sessions</div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ MOBILE-FIRST: System Status - Dark theme */}
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: '#39414E' }}>
          <div className="text-xs space-y-1" style={{ color: '#9FA3AC' }}>
            <div className="flex items-center justify-center space-x-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#86EFAC' }}></span>
              <span>Audit system active</span>
            </div>
            <div>Last updated: {DateTime.now().setZone('America/New_York').toFormat('HH:mm')} EST</div>
            <div>Location: {selectedLocation}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;