import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import { getLocationByCode, quantityFieldMap } from '../config/theme';
import auditLogger from '../utils/auditLogger';
import { supabaseReplacementAPI, utils } from '../utils/api';

const CountItems = ({ selectedLocation, user, countMode = 'full' }) => {
  // ✅ SIMPLIFIED: Core state only
  const [components, setComponents] = useState([]);
  const [currentSku, setCurrentSku] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success', 'error', 'info'
  const [isActive, setIsActive] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Mobile-optimized refs
  const skuInputRef = useRef(null);
  const quantityInputRef = useRef(null);

  // Location info
  const locationInfo = getLocationByCode(selectedLocation);
  const locationName = locationInfo?.name || selectedLocation;

  // Determine count source based on mode
  const countSource = countMode === 'priority' ? 'priority' : 'full';

  // ✅ SIMPLIFIED: Generate session ID
  useEffect(() => {
    if (isActive && !sessionId) {
      const session = `${countSource}_${DateTime.now().toFormat('yyyy-MM-dd')}_${selectedLocation}_${Date.now()}`;
      setSessionId(session);
    }
  }, [isActive, sessionId, countSource, selectedLocation]);

  // ✅ MOBILE-FIRST: Auto-focus management
  useEffect(() => {
    if (isActive && skuInputRef.current) {
      const timer = setTimeout(() => skuInputRef.current.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // ✅ MOBILE-FIRST: Auto-focus quantity after SKU entry
  useEffect(() => {
    if (currentSku && quantityInputRef.current) {
      const timer = setTimeout(() => quantityInputRef.current.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [currentSku]);

  // ✅ SIMPLIFIED: Smart SKU filtering for auto-complete
  useEffect(() => {
    if (currentSku.length >= 2) {
      const filtered = components
        .filter(comp => 
          comp.barcode.toLowerCase().includes(currentSku.toLowerCase()) ||
          comp.id?.toLowerCase().includes(currentSku.toLowerCase())
        )
        .slice(0, 5); // Mobile-friendly limit
      
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [currentSku, components]);

  // ✅ SIMPLIFIED: Fetch components based on count mode
  const fetchComponents = useCallback(async () => {
    if (!utils.isAuthenticated()) {
      setStatus('Authentication required. Please log in.');
      setStatusType('error');
      return;
    }

    try {
      let data;
      
      if (countMode === 'priority') {
        // Get only high volume components
        data = await supabaseReplacementAPI.getComponentsWithCountStatus(selectedLocation, 'priority');
        data = data?.filter(comp => comp.is_high_volume) || [];
      } else {
        // Get all components
        data = await supabaseReplacementAPI.getComponentsWithCountStatus(selectedLocation, 'monthly');
      }
      
      setComponents(data || []);
      
    } catch (error) {
      console.error('Error fetching components:', error);
      setStatus(`Error loading items: ${error.message}`);
      setStatusType('error');
    }
  }, [selectedLocation, countMode]);

  // ✅ SIMPLIFIED: Load components on mount
  useEffect(() => {
    if (user) {
      fetchComponents();
    }
  }, [user, fetchComponents]);

  // ✅ SIMPLIFIED: Start counting
  const startCount = async () => {
    try {
      setIsActive(true);
      setStatus(`Started ${countSource} count at ${locationName}`);
      setStatusType('success');

      await auditLogger.logCycleCountAction(
        selectedLocation,
        `${countSource}_count_started`,
        false,
        {
          session_id: sessionId,
          count_mode: countMode,
          total_components: components.length
        }
      );

    } catch (error) {
      console.error('Error starting count:', error);
      setStatus(`Error starting count: ${error.message}`);
      setStatusType('error');
    }
  };

  // ✅ SIMPLIFIED: Reset count
  const resetCount = async () => {
    if (!window.confirm(`Reset ${countSource} count for ${locationName}?`)) return;

    try {
      await supabaseReplacementAPI.resetComponentCounts(selectedLocation, countSource);
      
      setIsActive(false);
      setScanHistory([]);
      setCurrentSku('');
      setCurrentQuantity('');
      setSessionId('');
      
      setStatus(`${countSource} count reset for ${locationName}`);
      setStatusType('success');
      
      await fetchComponents();

    } catch (error) {
      setStatus(`Error resetting count: ${error.message}`);
      setStatusType('error');
    }
  };

  // ✅ MOBILE-FIRST: Handle barcode scan/entry
  const handleScan = async (e) => {
    e.preventDefault();
    
    if (!currentSku.trim()) {
      setStatus('Please enter or scan a SKU');
      setStatusType('error');
      return;
    }

    if (currentQuantity === '') {
      setStatus('Please enter a quantity');
      setStatusType('error');
      return;
    }

    try {
      // Find component
      const component = components.find(c => 
        c.barcode === currentSku || c.id === currentSku
      );

      if (!component) {
        setStatus(`SKU "${currentSku}" not found in ${countSource} count list`);
        setStatusType('error');
        return;
      }

      const enteredQty = parseInt(currentQuantity, 10);
      const actualQty = component[quantityFieldMap[selectedLocation]] || 0;

      // Create history entry
      const historyEntry = {
        sku: currentSku,
        description: component.description || component.id,
        enteredQty,
        actualQty,
        isCorrect: enteredQty === actualQty,
        timestamp: DateTime.now().toFormat('HH:mm:ss'),
        isPriority: component.is_high_volume
      };

      // Update component with count tracking
      await supabaseReplacementAPI.updateComponentWithCountTracking(
        component.barcode,
        enteredQty,
        selectedLocation,
        countSource,
        sessionId,
        user?.id,
        DateTime.now().toISO()
      );

      // Log to audit
      await auditLogger.logInventoryScan(
        component.barcode,
        enteredQty,
        selectedLocation,
        `${countSource}_count`,
        {
          expected_quantity: actualQty,
          is_correct: enteredQty === actualQty,
          session_id: sessionId,
          description: component.description
        }
      );

      // Update UI
      setScanHistory(prev => [historyEntry, ...prev.slice(0, 4)]); // Keep 5 recent
      
      if (enteredQty === actualQty) {
        setStatus(`✓ ${component.description || currentSku} - Correct!`);
        setStatusType('success');
      } else {
        setStatus(`✗ ${component.description || currentSku} - Check quantity`);
        setStatusType('error');
      }

      // ✅ MOBILE-FIRST: Auto-clear and refocus
      setTimeout(() => {
        setCurrentSku('');
        setCurrentQuantity('');
        setShowSuggestions(false);
        if (skuInputRef.current) {
          skuInputRef.current.focus();
        }
      }, 1500);

      // Refresh components
      await fetchComponents();

    } catch (error) {
      console.error('Scan error:', error);
      setStatus(`Error processing scan: ${error.message}`);
      setStatusType('error');
    }
  };

  // ✅ MOBILE-FIRST: Handle suggestion selection
  const selectSuggestion = (suggestion) => {
    setCurrentSku(suggestion.barcode);
    setShowSuggestions(false);
    if (quantityInputRef.current) {
      quantityInputRef.current.focus();
    }
  };

  // ✅ MOBILE-FIRST: Keyboard navigation
  const handleSkuKeyPress = (e) => {
    if (e.key === 'Enter' && currentSku) {
      e.preventDefault();
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }
  };

  const handleQuantityKeyPress = (e) => {
    if (e.key === 'Enter' && currentQuantity) {
      e.preventDefault();
      handleScan(e);
    }
  };

  // ✅ NEW: Camera barcode scanning (placeholder for future implementation)
  const startCamera = async () => {
    try {
      setStatus('Camera scanning not yet implemented - coming soon!');
      setStatusType('info');
      // TODO: Implement camera scanning
    } catch (error) {
      setStatus('Camera access failed');
      setStatusType('error');
    }
  };

  // ✅ SIMPLIFIED: Calculate progress
  const getProgress = () => {
    if (!components.length) return 0;
    
    const counted = components.filter(comp => {
      if (!comp.last_counted_date) return false;
      const countedDate = DateTime.fromISO(comp.last_counted_date);
      const today = DateTime.now().startOf('day');
      return countedDate >= today && comp.last_counted_source === countSource;
    }).length;
    
    return Math.round((counted / components.length) * 100);
  };

  const progress = getProgress();
  const countedToday = components.filter(comp => {
    if (!comp.last_counted_date) return false;
    const countedDate = DateTime.fromISO(comp.last_counted_date);
    const today = DateTime.now().startOf('day');
    return countedDate >= today && comp.last_counted_source === countSource;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ MOBILE-FIRST: Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {countMode === 'priority' ? '📊 Priority Count' : '📋 Full Count'}
              </h1>
              <p className="text-sm text-gray-600">{locationName}</p>
            </div>
            {isActive && (
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-600">{progress}%</div>
                <div className="text-xs text-gray-500">{countedToday}/{components.length}</div>
              </div>
            )}
          </div>
          
          {isActive && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {!isActive ? (
          /* ✅ MOBILE-FIRST: Start Screen */
          <div className="bg-white rounded-xl p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">
                {countMode === 'priority' ? '📊' : '📋'}
              </span>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {countMode === 'priority' ? 'Priority Count' : 'Full Count'}
              </h2>
              <p className="text-gray-600 mt-1">
                {countMode === 'priority' 
                  ? 'Count high-volume items only'
                  : 'Count all items in location'
                }
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-gray-900">{components.length}</div>
                <div className="text-sm text-gray-600">Items to count</div>
                {countedToday > 0 && (
                  <div className="text-xs text-emerald-600">{countedToday} already counted today</div>
                )}
              </div>
            </div>

            <button
              onClick={startCount}
              className="w-full bg-emerald-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 transition-all"
            >
              Start Counting
            </button>
          </div>
        ) : (
          /* ✅ MOBILE-FIRST: Scanning Interface */
          <>
            {/* Status Message */}
            {status && (
              <div className={`p-4 rounded-lg border ${
                statusType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                statusType === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <div className="flex items-center">
                  <span className="mr-2">
                    {statusType === 'success' ? '✓' : statusType === 'error' ? '✗' : 'ℹ'}
                  </span>
                  <span className="text-sm font-medium">{status}</span>
                </div>
              </div>
            )}

            {/* Scanning Form */}
            <div className="bg-white rounded-xl p-4 space-y-4">
              {/* SKU Input with Suggestions */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU / Barcode
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <input
                      ref={skuInputRef}
                      type="text"
                      value={currentSku}
                      onChange={(e) => setCurrentSku(e.target.value)}
                      onKeyPress={handleSkuKeyPress}
                      className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Enter or scan SKU..."
                      autoComplete="off"
                    />
                    
                    {/* Auto-complete Suggestions */}
                    {showSuggestions && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => selectSuggestion(suggestion)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{suggestion.id || suggestion.barcode}</div>
                            {suggestion.description && (
                              <div className="text-sm text-gray-600 truncate">{suggestion.description}</div>
                            )}
                            {suggestion.is_high_volume && (
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-1">
                                Priority
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-emerald-500"
                  >
                    📷
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(e.target.value)}
                  onKeyPress={handleQuantityKeyPress}
                  min="0"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter quantity..."
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleScan}
                disabled={!currentSku || currentQuantity === ''}
                className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 transition-all"
              >
                Submit Count
              </button>
            </div>

            {/* Recent Scans */}
            {scanHistory.length > 0 && (
              <div className="bg-white rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Scans</h3>
                <div className="space-y-2">
                  {scanHistory.map((scan, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        scan.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={scan.isCorrect ? 'text-emerald-600' : 'text-red-600'}>
                            {scan.isCorrect ? '✓' : '✗'}
                          </span>
                          <span className="font-medium text-gray-900">{scan.sku}</span>
                          {scan.isPriority && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              Priority
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{scan.timestamp}</span>
                      </div>
                      {scan.description && (
                        <div className="text-sm text-gray-600 mt-1">{scan.description}</div>
                      )}
                      <div className="text-sm mt-1">
                        Entered: <span className="font-medium">{scan.enteredQty}</span>
                        {!scan.isCorrect && (
                          <span className="text-red-600 ml-2">
                            (Expected: {scan.actualQty})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset Button */}
            <div className="text-center">
              <button
                onClick={resetCount}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 focus:ring-4 focus:ring-red-200 transition-all"
              >
                Reset Count
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CountItems;