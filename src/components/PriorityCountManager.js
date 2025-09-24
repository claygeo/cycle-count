import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { priorityAPI, supabaseReplacementAPI } from '../utils/api';

// =====================================================
// CONSTANTS (Outside components to avoid re-renders)
// =====================================================

const DAYS_OF_WEEK = [
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' }
];

// =====================================================
// 1. FIXED PRIORITY COUNT DAY SELECTION COMPONENT
// =====================================================

const PriorityCountDaySelection = ({ user, selectedLocation, onBack, onStartCount, onStatsUpdate, isAdmin }) => {
  const [selectedDay, setSelectedDay] = useState('');
  const [dayStats, setDayStats] = useState({});
  const [weeklyProgress, setWeeklyProgress] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  // Fetch stats with clean progress tracking
  const fetchDayStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const stats = {};
      const progress = {};
      
      // Get current week start date (Monday)
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(now.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      console.log('📅 Current week start (Monday):', startOfWeek.toISOString());
      
      // Get counts for each day
      for (const day of DAYS_OF_WEEK) {
        try {
          const priorityData = await priorityAPI.getPriorityForDay(day.value, selectedLocation);
          const totalPriorityItems = priorityData?.components?.length || 0;
          stats[day.value] = totalPriorityItems;
          
          // Count how many priority items have been scanned this week for this day
          if (totalPriorityItems > 0) {
            const countedThisWeek = priorityData.components.filter(comp => {
              if (!comp.last_counted_date || comp.last_counted_source !== 'weekly') return false;
              const countedDate = new Date(comp.last_counted_date);
              const isThisWeek = countedDate >= startOfWeek;
              console.log(`${day.value} - ${comp.barcode}: counted ${comp.last_counted_date}, isThisWeek: ${isThisWeek}, source: ${comp.last_counted_source}`);
              return isThisWeek;
            }).length;
            
            progress[day.value] = {
              counted: countedThisWeek,
              total: totalPriorityItems,
              percentage: Math.round((countedThisWeek / totalPriorityItems) * 100)
            };
          } else {
            progress[day.value] = { counted: 0, total: 0, percentage: 0 };
          }
        } catch (error) {
          console.error(`Error fetching priority data for ${day.value}:`, error);
          stats[day.value] = 0;
          progress[day.value] = { counted: 0, total: 0, percentage: 0 };
        }
      }
      
      setDayStats(stats);
      setWeeklyProgress(progress);
    } catch (error) {
      console.error('Error fetching day stats:', error);
      setStatus('Error loading priority data');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (user) {
      fetchDayStats();
    }
  }, [user, fetchDayStats]);

  // ✅ ENHANCED: Reset weekly priority counts with better feedback and error handling
  const handleResetWeeklyCount = async () => {
    const totalCountedItems = Object.values(weeklyProgress).reduce((sum, day) => sum + day.counted, 0);
    
    if (totalCountedItems === 0) {
      setStatus('No items to reset - weekly progress is already at 0%');
      setStatusType('error');
      return;
    }

    if (!window.confirm(`Reset weekly priority counts? This will clear ${totalCountedItems} scanned items from this week's progress. Monthly progress will be unaffected. This action cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      setStatus('Resetting weekly priority counts...');
      setStatusType('info');
      
      console.log('🔄 Starting weekly priority reset...');
      
      // ✅ FIXED: Call the API to reset weekly counts - server now has the missing .from('components') fix
      const response = await supabaseReplacementAPI.resetCounts(selectedLocation, 'weekly');
      
      console.log('✅ Reset API response:', response);
      
      // ✅ ENHANCED: More detailed success feedback
      const successMessage = response.affected_components > 0 
        ? `Weekly priority counts reset successfully. ${response.affected_components} components updated.`
        : 'Weekly priority counts reset completed. No items were currently counted.';
      
      setStatus(successMessage);
      setStatusType('success');
      setShowResetModal(false);
      
      // Clear local progress state immediately for better UX
      const emptyProgress = {};
      DAYS_OF_WEEK.forEach(day => {
        emptyProgress[day.value] = { counted: 0, total: dayStats[day.value] || 0, percentage: 0 };
      });
      setWeeklyProgress(emptyProgress);
      
      // Refresh data after a short delay to allow server to complete
      setTimeout(async () => {
        console.log('🔄 Refreshing data after reset...');
        await fetchDayStats();
        if (onStatsUpdate) {
          onStatsUpdate();
        }
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error resetting weekly count:', error);
      setStatus(`Error resetting count: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCount = () => {
    if (selectedDay && dayStats[selectedDay] > 0) {
      onStartCount(selectedDay);
    }
  };

  const getTotalPriorityCount = () => {
    return Object.values(dayStats).reduce((sum, count) => sum + count, 0);
  };

  const getTotalWeeklyProgress = () => {
    const totals = Object.values(weeklyProgress).reduce(
      (acc, day) => ({
        counted: acc.counted + day.counted,
        total: acc.total + day.total
      }),
      { counted: 0, total: 0 }
    );
    
    return totals.total > 0 ? Math.round((totals.counted / totals.total) * 100) : 0;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#15161B' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#181B22' }} className="shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={fetchDayStats}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? '0.7' : '1'
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <h1 className="text-lg font-bold" style={{ color: '#FAFCFB' }}>
            Weekly Priority Count
          </h1>
          
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-lg border ${
            statusType === 'success' ? 'bg-emerald-900/20 border-emerald-400 text-emerald-300' :
            statusType === 'info' ? 'bg-blue-900/20 border-blue-400 text-blue-300' :
            'bg-red-900/20 border-red-400 text-red-300'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">
                {statusType === 'success' ? '✓' : statusType === 'info' ? 'ℹ' : '✗'}
              </span>
              <span className="text-sm font-medium">{status}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            className="rounded-xl p-4 shadow-sm border"
            style={{ 
              backgroundColor: '#181B22', 
              borderColor: '#39414E' 
            }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold mb-2" style={{ color: '#FAFCFB' }}>
                {getTotalPriorityCount()}
              </div>
              <div className="text-sm" style={{ color: '#9FA3AC' }}>
                Total Priority SKUs
              </div>
            </div>
          </div>
          
          <div 
            className="rounded-xl p-4 shadow-sm border"
            style={{ 
              backgroundColor: '#181B22', 
              borderColor: '#39414E' 
            }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold mb-2" style={{ color: '#FAFCFB' }}>
                {getTotalWeeklyProgress()}%
              </div>
              <div className="text-sm" style={{ color: '#9FA3AC' }}>
                Weekly Progress
              </div>
              {getTotalWeeklyProgress() > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                  <div 
                    className="h-1 rounded-full transition-all duration-300"
                    style={{ 
                      backgroundColor: '#86EFAC',
                      width: `${getTotalWeeklyProgress()}%` 
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Day Selection */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
              Select Day for Priority Count
            </h3>
            {isAdmin && getTotalWeeklyProgress() > 0 && (
              <button
                onClick={() => setShowResetModal(true)}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reset Week
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day) => {
              const count = dayStats[day.value] || 0;
              const progress = weeklyProgress[day.value] || { counted: 0, total: 0, percentage: 0 };
              const isDisabled = count === 0;
              
              return (
                <div
                  key={day.value}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedDay === day.value 
                      ? 'border-emerald-400 bg-emerald-900/20' 
                      : isDisabled 
                        ? 'border-gray-600 opacity-50 cursor-not-allowed'
                        : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onClick={() => {
                    if (!isDisabled) {
                      setSelectedDay(day.value);
                    }
                  }}
                  style={{
                    borderColor: selectedDay === day.value ? '#86EFAC' : '#39414E'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="selectedDay"
                        value={day.value}
                        checked={selectedDay === day.value}
                        onChange={() => {}}
                        disabled={isDisabled}
                        className="mr-3"
                        style={{ accentColor: '#86EFAC' }}
                      />
                      <span className="font-medium" style={{ 
                        color: isDisabled ? '#9FA3AC' : '#FAFCFB' 
                      }}>
                        {day.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm" style={{ 
                        color: isDisabled ? '#9FA3AC' : '#86EFAC' 
                      }}>
                        {isLoading ? '...' : `${count} SKUs`}
                      </div>
                      {count > 0 && (
                        <div className="text-xs" style={{ color: '#9FA3AC' }}>
                          {progress.counted}/{progress.total}
                          {progress.counted > 0 && (
                            <span className="ml-1" style={{ color: '#86EFAC' }}>
                              ✓
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Count Button */}
        <button
          onClick={handleStartCount}
          disabled={!selectedDay || isLoading || (dayStats[selectedDay] || 0) === 0}
          className="w-full py-4 rounded-lg font-medium text-lg"
          style={{ 
            backgroundColor: (!selectedDay || isLoading || (dayStats[selectedDay] || 0) === 0) 
              ? '#39414E' 
              : '#86EFAC',
            color: (!selectedDay || isLoading || (dayStats[selectedDay] || 0) === 0) 
              ? '#9FA3AC' 
              : '#00001C',
            border: 'none',
            cursor: (!selectedDay || isLoading || (dayStats[selectedDay] || 0) === 0) 
              ? 'not-allowed' 
              : 'pointer'
          }}
        >
          {!selectedDay ? 'Select a Day' : 
           isLoading ? 'Loading...' : 
           (dayStats[selectedDay] || 0) === 0 ? 'No Priority SKUs' :
           weeklyProgress[selectedDay]?.counted > 0 ? 
           `Continue ${selectedDay} count (${weeklyProgress[selectedDay].counted}/${dayStats[selectedDay]})` :
           `Start ${selectedDay} count (${dayStats[selectedDay]} SKUs)`}
        </button>

        {/* ✅ ENHANCED: Reset Confirmation Modal with better details */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div 
              className="rounded-xl p-6 max-w-md w-full"
              style={{ 
                backgroundColor: '#181B22', 
                borderColor: '#39414E' 
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#FAFCFB' }}>
                Reset Weekly Priority Count
              </h3>
              
              <div className="space-y-3 mb-6">
                <p className="text-sm" style={{ color: '#9FA3AC' }}>
                  This will reset all weekly priority scan progress for {selectedLocation}. 
                </p>
                
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#86EFAC20', borderColor: '#86EFAC', border: '1px solid' }}>
                  <div className="text-sm font-medium" style={{ color: '#86EFAC' }}>
                    Items to be reset:
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#9FA3AC' }}>
                    {Object.values(weeklyProgress).reduce((sum, day) => sum + day.counted, 0)} scanned items across all days
                  </div>
                </div>
                
                <p className="text-xs" style={{ color: '#9FA3AC' }}>
                  Monthly progress will remain unaffected. This action cannot be undone.
                </p>
                
                <p className="text-xs" style={{ color: '#86EFAC' }}>
                  ✅ Server reset functionality has been fixed and should work properly.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-3 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: '#39414E', 
                    color: '#FAFCFB',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetWeeklyCount}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C',
                    border: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? '0.7' : '1'
                  }}
                >
                  {isLoading ? 'Resetting...' : 'Reset Week'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// 2. ACTIVE PRIORITY COUNTING COMPONENT - CLEANED UP
// =====================================================

const ActivePriorityCount = ({ user, selectedLocation, selectedDay, onBack, onComplete, onStatsUpdate }) => {
  const [priorityComponents, setPriorityComponents] = useState([]);
  const [countedComponents, setCountedComponents] = useState(new Set());
  const [currentSku, setCurrentSku] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  
  // Scan history state
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Camera/Scanner state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSupported, setCameraSupported] = useState(true);

  // Refs
  const skuInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scannerRef = useRef(null);

  // Count session (stable across renders)
  const countSession = useMemo(() => `priority_count_${selectedDay}_${Date.now()}`, [selectedDay]);

  // Stop camera function
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    
    setShowCamera(false);
    setIsScanning(false);
    setCameraError('');
  }, [cameraStream]);

  // Check camera support on component mount
  useEffect(() => {
    const checkCameraSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSupported(false);
        return;
      }
      setCameraSupported(true);
    };
    
    checkCameraSupport();
  }, []);

  // Initialize barcode scanner when camera is shown
  useEffect(() => {
    const initializeScanner = async () => {
      if (showCamera && videoRef.current && !scannerRef.current) {
        try {
          const Quagga = await import('quagga');
          
          const config = {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: videoRef.current,
              constraints: {
                width: 320,
                height: 240,
                facingMode: "environment"
              }
            },
            decoder: {
              readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader"
              ]
            },
            locate: true,
            locator: {
              halfSample: true,
              patchSize: "medium"
            }
          };

          Quagga.init(config, (err) => {
            if (err) {
              console.error('Quagga initialization error:', err);
              setCameraError('Failed to initialize barcode scanner');
              return;
            }
            
            Quagga.start();
            setIsScanning(true);
            
            Quagga.onDetected((result) => {
              if (result && result.codeResult && result.codeResult.code) {
                const barcode = result.codeResult.code;
                setCurrentSku(barcode);
                stopCamera();
                setStatus(`Barcode scanned: ${barcode}`);
                setStatusType('success');
                
                if (skuInputRef.current) {
                  skuInputRef.current.focus();
                }
              }
            });
          });

          scannerRef.current = Quagga;
        } catch (error) {
          console.error('Error loading barcode scanner:', error);
          setCameraError('Barcode scanner not available');
        }
      }
    };

    if (showCamera) {
      initializeScanner();
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current = null;
        } catch (error) {
          console.error('Error stopping scanner:', error);
        }
      }
    };
  }, [showCamera, stopCamera]);

  // Start camera function
  const startCamera = async () => {
    if (!cameraSupported) {
      setCameraError('Camera not supported on this device');
      return;
    }

    try {
      setCameraError('');
      setShowCamera(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Camera access denied or not available');
      setShowCamera(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (status && statusType === 'success') {
      const timer = setTimeout(() => {
        setStatus('');
        setStatusType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, statusType]);

  // Fetch scan history for priority scans only
  const fetchScanHistory = useCallback(async (barcode) => {
    try {
      setHistoryLoading(true);
      
      const history = await supabaseReplacementAPI.getComponentScanHistory(barcode, selectedLocation, 90);
      
      // Filter for priority/weekly scans only
      const priorityScans = history.filter(entry => 
        entry.count_type === 'priority' || 
        entry.source?.includes('weekly') ||
        entry.source?.includes('priority')
      ).slice(0, 20);
      
      setScanHistory(priorityScans);
      
    } catch (error) {
      console.error('Error fetching scan history:', error);
      setScanHistory([]);
      setStatus('Failed to load scan history');
      setStatusType('error');
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedLocation]);

  // Handle scan history drill-down
  const handleScanHistoryDrillDown = async (component) => {
    setSelectedComponent(component);
    setShowHistoryModal(true);
    await fetchScanHistory(component.barcode);
  };

  // Close modal when clicking outside
  const handleModalBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      setShowHistoryModal(false);
    }
  }, []);

  // Fetch priority components for the selected day
  const fetchPriorityComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const priorityData = await priorityAPI.getPriorityForDay(selectedDay, selectedLocation);
      const components = priorityData?.components || [];
      setPriorityComponents(components);
      
      // Track which components have been scanned this week
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(now.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const countedThisWeek = new Set();
      components.forEach(comp => {
        if (comp.last_counted_date && 
            comp.last_counted_source === 'weekly' &&
            new Date(comp.last_counted_date) >= startOfWeek) {
          countedThisWeek.add(comp.barcode);
        }
      });
      
      setCountedComponents(countedThisWeek);
      
      // Focus on SKU input after loading
      setTimeout(() => {
        if (skuInputRef.current) {
          skuInputRef.current.focus();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error fetching priority components:', error);
      setStatus(`Error loading priority SKUs: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDay, selectedLocation]);

  // Load data on mount
  useEffect(() => {
    if (user && selectedDay) {
      fetchPriorityComponents();
    }
  }, [user, selectedDay, fetchPriorityComponents]);

  // Filter components based on search
  useEffect(() => {
    if (currentSku.length >= 1) {
      const filtered = priorityComponents.filter(comp =>
        comp.barcode?.toLowerCase().includes(currentSku.toLowerCase()) ||
        comp.id?.toLowerCase().includes(currentSku.toLowerCase()) ||
        comp.description?.toLowerCase().includes(currentSku.toLowerCase())
      ).slice(0, 10);
      setFilteredComponents(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setFilteredComponents([]);
      setShowDropdown(false);
    }
  }, [currentSku, priorityComponents]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          skuInputRef.current && !skuInputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle SKU selection from dropdown - dropdown disappears immediately
  const handleSkuSelect = (component) => {
    setCurrentSku(component.barcode);
    setShowDropdown(false);
    
    // Focus quantity input immediately
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }, 50);
  };

  // Submit count
  const handleSubmitCount = async () => {
    if (!currentSku || !currentQuantity) {
      setStatus('Please enter both SKU and quantity');
      setStatusType('error');
      return;
    }

    // Verify SKU exists in priority list
    const component = priorityComponents.find(comp => 
      comp.barcode === currentSku || comp.id === currentSku
    );

    if (!component) {
      setStatus('SKU not found in priority list for this day');
      setStatusType('error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Submit with 'priority' source
      await supabaseReplacementAPI.updateComponentWithCountTracking(
        component.barcode,
        parseInt(currentQuantity),
        selectedLocation,
        'priority',
        countSession,
        user.id,
        new Date().toISOString()
      );

      // Mark as counted
      setCountedComponents(prev => new Set([...prev, component.barcode]));
      
      // Clear inputs and focus back on SKU input
      setCurrentSku('');
      setCurrentQuantity('');
      
      setStatus(`Priority scanned: ${component.barcode} - Qty: ${currentQuantity}`);
      setStatusType('success');
      
      // Update parent stats
      if (onStatsUpdate) {
        onStatsUpdate();
      }
      
      setTimeout(() => {
        if (skuInputRef.current) {
          skuInputRef.current.focus();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error submitting count:', error);
      setStatus(`Error saving count: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key navigation
  const handleKeyPress = (e, nextAction) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextAction();
    }
  };

  // Calculate progress
  const totalComponents = priorityComponents.length;
  const countedCount = countedComponents.size;
  const progressPercentage = totalComponents > 0 ? Math.round((countedCount / totalComponents) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#15161B' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#181B22' }} className="shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={fetchPriorityComponents}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? '0.7' : '1'
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <h1 className="text-lg font-bold text-center" style={{ color: '#FAFCFB' }}>
            Priority Count - {selectedDay}
          </h1>
          
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg font-medium text-sm"
            style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Back
          </button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-lg border ${
            statusType === 'success' ? 'bg-emerald-900/20 border-emerald-400 text-emerald-300' :
            'bg-red-900/20 border-red-400 text-red-300'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">
                {statusType === 'success' ? '✓' : '✗'}
              </span>
              <span className="text-sm font-medium">{status}</span>
            </div>
          </div>
        )}

        {/* Progress Section */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium" style={{ color: '#FAFCFB' }}>
              {selectedDay} Progress
            </span>
            <span className="text-sm" style={{ color: '#9FA3AC' }}>
              {countedCount}/{totalComponents} ({progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{ 
                backgroundColor: '#86EFAC',
                width: `${progressPercentage}%` 
              }}
            />
          </div>
          {progressPercentage === 100 && (
            <div className="text-center mt-3">
              <div className="text-sm font-medium" style={{ color: '#86EFAC' }}>
                {selectedDay} priority count complete!
              </div>
            </div>
          )}
        </div>

        {/* SKU Input Section */}
        <div 
          className="rounded-xl p-4 shadow-sm border relative"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>
            Scan or Enter SKU
          </h3>
          
          <div className="relative mb-4">
            <div className="flex items-center">
              <input
                ref={skuInputRef}
                type="text"
                value={currentSku}
                onChange={(e) => setCurrentSku(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, () => {
                  if (quantityInputRef.current) {
                    quantityInputRef.current.focus();
                  }
                })}
                placeholder="SKU, barcode, or description..."
                className="flex-1 px-4 py-3 rounded-lg border text-base pr-12"
                style={{ 
                  backgroundColor: '#15161B', 
                  borderColor: '#39414E',
                  color: '#FAFCFB'
                }}
              />
              
              {/* Camera Scanner Button */}
              {cameraSupported && (
                <button
                  onClick={startCamera}
                  disabled={showCamera}
                  className="absolute right-3 p-2 rounded-lg"
                  style={{ 
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: showCamera ? 'not-allowed' : 'pointer',
                    opacity: showCamera ? '0.5' : '1'
                  }}
                  title="Scan barcode with camera"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#86EFAC"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1-2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Enhanced Dropdown */}
            {showDropdown && filteredComponents.length > 0 && (
              <div 
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg z-10"
                style={{ 
                  backgroundColor: '#86EFAC',
                  borderColor: '#39414E' 
                }}
              >
                {filteredComponents.map((comp, index) => {
                  const isCounted = countedComponents.has(comp.barcode);
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border-b cursor-pointer transition-colors duration-200 hover:bg-gray-600"
                      style={{ 
                        borderColor: '#00001C20',
                        backgroundColor: isCounted ? 'rgba(0, 0, 28, 0.2)' : 'transparent'
                      }}
                      onClick={() => handleSkuSelect(comp)}
                    >
                      <div className="flex-1 min-w-0 pointer-events-none">
                        <div className="flex items-center pointer-events-none">
                          <div className="font-medium pointer-events-none" style={{ color: '#00001C' }}>
                            {comp.id} • {comp.barcode}
                          </div>
                          <span className="ml-2 px-2 py-1 rounded text-xs font-bold pointer-events-none" style={{ backgroundColor: '#00001C', color: '#86EFAC' }}>
                            PRIORITY
                          </span>
                        </div>
                        {comp.description && (
                          <div className="text-sm truncate pointer-events-none" style={{ color: '#00001C' }}>
                            {comp.description}
                          </div>
                        )}
                        <div className="text-xs pointer-events-none" style={{ color: '#00001C' }}>
                          Current Qty: {comp.primary_quantity || 0}
                          {isCounted && (
                            <span className="ml-2 px-2 py-1 rounded text-xs font-bold pointer-events-none" style={{ backgroundColor: '#00001C', color: '#86EFAC' }}>
                              Counted This Week
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="mb-4">
            <input
              ref={quantityInputRef}
              type="number"
              value={currentQuantity}
              onChange={(e) => setCurrentQuantity(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleSubmitCount)}
              placeholder="Enter quantity..."
              className="w-full px-4 py-3 rounded-lg border text-base"
              style={{ 
                backgroundColor: '#15161B', 
                borderColor: '#39414E',
                color: '#FAFCFB'
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitCount}
            disabled={!currentSku || !currentQuantity || isLoading}
            className="w-full py-3 rounded-lg font-medium text-base"
            style={{ 
              backgroundColor: (!currentSku || !currentQuantity || isLoading) 
                ? '#39414E' 
                : '#86EFAC',
              color: (!currentSku || !currentQuantity || isLoading) 
                ? '#9FA3AC' 
                : '#00001C',
              border: 'none',
              cursor: (!currentSku || !currentQuantity || isLoading) 
                ? 'not-allowed' 
                : 'pointer'
            }}
          >
            {isLoading ? 'Saving...' : 'Submit Count'}
          </button>
        </div>

        {/* Camera Scanner Modal */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div 
              className="rounded-xl p-6 max-w-md w-full mx-4"
              style={{ 
                backgroundColor: '#181B22', 
                borderColor: '#39414E' 
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#FAFCFB' }}>
                  Scan Barcode
                </h3>
                <button
                  onClick={stopCamera}
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
              
              {cameraError ? (
                <div className="text-center py-8">
                  <div className="text-red-400 mb-4">{cameraError}</div>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-lg font-medium"
                    style={{ 
                      backgroundColor: '#86EFAC', 
                      color: '#00001C',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div 
                    className="relative mb-4 rounded-lg overflow-hidden"
                    style={{ backgroundColor: '#15161B' }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '240px',
                        objectFit: 'cover'
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      style={{ display: 'none' }}
                    />
                  </div>
                  
                  <div className="text-sm mb-4" style={{ color: '#9FA3AC' }}>
                    {isScanning ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-pulse mr-2">📷</div>
                        Position barcode in camera view
                      </div>
                    ) : (
                      'Initializing camera...'
                    )}
                  </div>
                  
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-lg font-medium"
                    style={{ 
                      backgroundColor: '#86EFAC', 
                      color: '#00001C',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ CLEANED UP: Scan History Modal (shows only user names, no IDs) */}
        {showHistoryModal && selectedComponent && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={handleModalBackdropClick}
          >
            <div 
              className="rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              style={{ 
                backgroundColor: '#181B22', 
                borderColor: '#39414E' 
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#FAFCFB' }}>
                  Scan History - {selectedComponent.barcode}
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <div className="text-sm" style={{ color: '#9FA3AC' }}>
                  {selectedComponent.description}
                </div>
                <div className="text-xs mt-1" style={{ color: '#9FA3AC' }}>
                  Current Quantity: {selectedComponent.primary_quantity || 0}
                  <span className="ml-2 px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: '#86EFAC', color: '#00001C' }}>
                    PRIORITY ITEM
                  </span>
                </div>
              </div>
              
              {historyLoading ? (
                <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
                  Loading scan history...
                </div>
              ) : scanHistory.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
                  No priority scan history found for the last 90 days
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm" style={{ color: '#FAFCFB' }}>
                    Recent Priority Scans ({scanHistory.length})
                  </h4>
                  {scanHistory.map((scan, index) => {
                    return (
                      <div
                        key={index}
                        className="p-3 rounded-lg border"
                        style={{ 
                          backgroundColor: '#15161B', 
                          borderColor: '#39414E' 
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm" style={{ color: '#FAFCFB' }}>
                              {selectedComponent.barcode} - Qty: {scan.quantity}
                            </div>
                            <div className="text-xs" style={{ color: '#9FA3AC' }}>
                              {scan.user_name || 'Unknown User'}
                            </div>
                            <div className="text-xs" style={{ color: '#9FA3AC' }}>
                              {new Date(scan.timestamp).toLocaleDateString()} at {new Date(scan.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs px-2 py-1 rounded" style={{ 
                              backgroundColor: '#86EFAC', 
                              color: '#00001C' 
                            }}>
                              Priority Count
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ CLEANED UP: Priority SKU List (removed redundant text) */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
              Priority SKUs for {selectedDay} ({totalComponents})
            </h3>
            
            {countedCount === totalComponents && totalComponents > 0 && (
              <button
                onClick={onComplete}
                className="px-4 py-2 rounded-lg font-medium text-sm"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Complete Count
              </button>
            )}
          </div>

          {priorityComponents.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
              <div className="text-lg mb-2">No priority SKUs for {selectedDay}</div>
              <div className="text-sm">Check with administrator to add priority items</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {priorityComponents.map((comp, index) => {
                const isCounted = countedComponents.has(comp.barcode);
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-800 ${
                      isCounted ? 'bg-emerald-900/20 border-emerald-400' : ''
                    }`}
                    style={{ 
                      backgroundColor: isCounted ? '#86EFAC20' : '#15161B', 
                      borderColor: isCounted ? '#86EFAC' : '#39414E' 
                    }}
                    onDoubleClick={() => handleScanHistoryDrillDown(comp)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="font-medium" style={{ color: '#FAFCFB' }}>
                          {comp.id} • {comp.barcode}
                        </div>
                        <span className="ml-2 px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: '#86EFAC', color: '#00001C' }}>
                          PRIORITY
                        </span>
                      </div>
                      {comp.description && (
                        <div className="text-sm truncate" style={{ color: '#9FA3AC' }}>
                          {comp.description}
                        </div>
                      )}
                      <div className="text-xs" style={{ color: '#9FA3AC' }}>
                        Current Qty: {comp.primary_quantity || 0}
                        {comp.last_counted_date && (
                          <span className="ml-2">
                            • Last: {new Date(comp.last_counted_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isCounted && (
                      <div className="px-3 py-1 rounded-lg text-sm font-medium" style={{ 
                        backgroundColor: '#86EFAC', 
                        color: '#00001C' 
                      }}>
                        Counted
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =====================================================
// 3. MAIN PRIORITY COUNT MANAGER COMPONENT
// =====================================================

const PriorityCountManager = ({ user, selectedLocation, onBack, onStatsUpdate }) => {
  const [currentView, setCurrentView] = useState('daySelection');
  const [selectedDay, setSelectedDay] = useState('');

  // Check if user is admin
  const isAdmin = user?.email === 'admin@example.com' || 
                  user?.email === 'test@example.com' || 
                  user?.role === 'admin';

  const handleStartCount = (day) => {
    setSelectedDay(day);
    setCurrentView('counting');
  };

  const handleBackToDaySelection = () => {
    setCurrentView('daySelection');
    setSelectedDay('');
  };

  const handleCompleteCount = () => {
    // Update stats before going back
    if (onStatsUpdate) {
      onStatsUpdate();
    }
    onBack(); // Go directly back to main dashboard
  };

  // Show different views based on current state
  if (currentView === 'counting') {
    return (
      <ActivePriorityCount
        user={user}
        selectedLocation={selectedLocation}
        selectedDay={selectedDay}
        onBack={handleBackToDaySelection}
        onComplete={handleCompleteCount}
        onStatsUpdate={onStatsUpdate}
      />
    );
  }

  // Default view: Day selection
  return (
    <PriorityCountDaySelection
      user={user}
      selectedLocation={selectedLocation}
      onBack={onBack}
      onStartCount={handleStartCount}
      onStatsUpdate={onStatsUpdate}
      isAdmin={isAdmin}
    />
  );
};

// =====================================================
// 4. EXPORT ALL COMPONENTS
// =====================================================

export default PriorityCountManager;
export { 
  PriorityCountDaySelection, 
  ActivePriorityCount 
};