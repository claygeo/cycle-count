import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabaseReplacementAPI, priorityAPI } from '../utils/api';

// =====================================================
// FULL COUNT MANAGER COMPONENT - CLEAN UI VERSION
// =====================================================

const FullCountManager = ({ user, selectedLocation, onBack, onStatsUpdate, isAdmin }) => {
  const [components, setComponents] = useState([]);
  const [countedComponents, setCountedComponents] = useState(new Set());
  const [currentSku, setCurrentSku] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  
  // Enhanced scan history state
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [priorityDays, setPriorityDays] = useState({});
  
  // Reset functionality
  const [showResetModal, setShowResetModal] = useState(false);
  
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
  const countSession = useMemo(() => `full_count_${Date.now()}`, []);

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

  // Fetch priority days for a component
  const fetchPriorityDays = useCallback(async (barcode) => {
    try {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const priorityDaysForComponent = [];
      
      for (const day of days) {
        try {
          const priorityData = await priorityAPI.getPriorityForDay(day, selectedLocation);
          const isInPriorityForDay = priorityData?.components?.some(comp => comp.barcode === barcode);
          if (isInPriorityForDay) {
            priorityDaysForComponent.push(day);
          }
        } catch (error) {
          console.error(`Error checking priority for ${day}:`, error);
        }
      }
      
      return priorityDaysForComponent;
    } catch (error) {
      console.error('Error fetching priority days:', error);
      return [];
    }
  }, [selectedLocation]);

  // Fetch scan history with cleaned up display
  const fetchScanHistory = useCallback(async (barcode) => {
    try {
      setHistoryLoading(true);
      console.log(`🔄 Fetching scan history for ${barcode}`);
      
      // Get complete scan history
      const history = await supabaseReplacementAPI.getComponentScanHistory(barcode, selectedLocation, 90);
      
      // Get priority days for this component
      const componentPriorityDays = await fetchPriorityDays(barcode);
      setPriorityDays(prev => ({ ...prev, [barcode]: componentPriorityDays }));
      
      console.log(`✅ Fetched ${history.length} scan history entries for ${barcode}`);
      setScanHistory(history);
      
    } catch (error) {
      console.error('❌ Error fetching scan history:', error);
      setScanHistory([]);
      setStatus('Failed to load scan history');
      setStatusType('error');
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedLocation, fetchPriorityDays]);

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

  // ✅ FIXED: Enhanced fetch components with dual tracking awareness
  const fetchComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Fetching components with dual tracking awareness...');
      
      // Get all components
      const allComponents = await supabaseReplacementAPI.getComponentsWithCountStatus(selectedLocation, 'monthly');
      
      // Get start of current month in EST (to match server timezone logic)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      console.log('📅 Month boundary for dual tracking check:', startOfMonth.toISOString());
      
      const countedThisMonth = new Set();
      
      if (allComponents) {
        // ✅ STEP 1: Check components table for direct monthly counts and priority items with weekly source
        allComponents.forEach(comp => {
          if (comp.last_counted_date && new Date(comp.last_counted_date) >= startOfMonth) {
            // Include if:
            // 1. Directly counted via monthly source, OR
            // 2. Has weekly source (could be dual tracking - we'll verify with count_history)
            if (comp.last_counted_source === 'monthly' || comp.last_counted_source === 'weekly') {
              countedThisMonth.add(comp.barcode);
              console.log(`✅ Component ${comp.barcode} counted this month via ${comp.last_counted_source} source`);
            }
          }
        });
        
        // ✅ STEP 2: Check count_history for dual tracking entries
        try {
          console.log('🔄 Checking count_history for dual tracking entries...');
          
          // Get dual tracking entries from count_history for this month
          const dualTrackingHistory = await supabaseReplacementAPI.getComponentScanHistory(null, selectedLocation, 31);
          
          // Filter for dual tracking entries this month with monthly count_type
          const thisMonthDualTracking = dualTrackingHistory.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            const isDualTracking = entry.metadata?.dual_tracking === true;
            const isMonthlyCounted = entry.count_type === 'monthly';
            const isThisMonth = entryDate >= startOfMonth;
            
            return isDualTracking && isMonthlyCounted && isThisMonth;
          });
          
          console.log(`✅ Found ${thisMonthDualTracking.length} dual tracking entries this month`);
          
          // Add dual tracked items to counted set
          thisMonthDualTracking.forEach(entry => {
            countedThisMonth.add(entry.sku);
            console.log(`✅ Component ${entry.sku} dual-tracked this month via priority scan`);
          });
          
        } catch (historyError) {
          console.warn('⚠️ Could not fetch dual tracking history:', historyError);
          // Continue without dual tracking history if it fails
        }
      }
      
      console.log(`✅ Total components counted this month: ${countedThisMonth.size}`);
      console.log('📋 Counted components:', Array.from(countedThisMonth));
      
      setComponents(allComponents || []);
      setCountedComponents(countedThisMonth);
      
      // Focus on SKU input after loading
      setTimeout(() => {
        if (skuInputRef.current) {
          skuInputRef.current.focus();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error fetching components:', error);
      setStatus(`Error loading components: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation]);

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchComponents();
    }
  }, [user, fetchComponents]);

  // Filter components based on search
  useEffect(() => {
    if (currentSku.length >= 1) {
      const filtered = components.filter(comp =>
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
  }, [currentSku, components]);

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

  // Handle SKU selection from dropdown
  const handleSkuSelect = (component) => {
    setCurrentSku(component.barcode);
    setShowDropdown(false);
    
    // Focus quantity input
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }, 100);
  };

  // Submit count with monthly source tracking
  const handleSubmitCount = async () => {
    if (!currentSku || !currentQuantity) {
      setStatus('Please enter both SKU and quantity');
      setStatusType('error');
      return;
    }

    // Verify SKU exists in component list
    const component = components.find(comp => 
      comp.barcode === currentSku || comp.id === currentSku
    );

    if (!component) {
      setStatus('SKU not found in component list');
      setStatusType('error');
      return;
    }

    try {
      setIsLoading(true);
      
      // Submit with 'full' source - server maps to 'monthly'
      await supabaseReplacementAPI.updateComponentWithCountTracking(
        component.barcode,
        parseInt(currentQuantity),
        selectedLocation,
        'full', // Server maps to 'monthly' for database
        countSession,
        user.id,
        new Date().toISOString()
      );

      // Mark as counted
      setCountedComponents(prev => new Set([...prev, component.barcode]));
      
      // Clear inputs and focus back on SKU input
      setCurrentSku('');
      setCurrentQuantity('');
      setStatus(`Counted: ${component.barcode} - Qty: ${currentQuantity}`);
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

  // ✅ FIX: Reset monthly counts function with proper error handling
  const handleResetMonthlyCount = async () => {
    try {
      setIsLoading(true);
      
      console.log('🔄 Starting monthly count reset...');
      
      // Call reset API
      const result = await supabaseReplacementAPI.resetCounts(selectedLocation, 'monthly');
      
      console.log('✅ Reset API response:', result);
      
      // Clear local state
      setCountedComponents(new Set());
      
      setStatus(`Monthly count reset successfully - ${result.affected_components || 0} components reset`);
      setStatusType('success');
      setShowResetModal(false);
      
      // Refresh data
      await fetchComponents();
      
      // Update parent stats
      if (onStatsUpdate) {
        onStatsUpdate();
      }
      
    } catch (error) {
      console.error('Error resetting monthly count:', error);
      setStatus(`Error resetting count: ${error.message}`);
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

  // Calculate progress including dual tracking
  const totalComponents = components.length;
  const countedCount = countedComponents.size;
  const progressPercentage = totalComponents > 0 ? Math.round((countedCount / totalComponents) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#15161B' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#181B22' }} className="shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={fetchComponents}
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
            Monthly Full Count
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

        {/* ✅ FIXED: Clean Progress Section - Removed "Enhanced:" text */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium" style={{ color: '#FAFCFB' }}>
              Monthly Progress
            </span>
            <div className="flex items-center space-x-4">
              <span className="text-sm" style={{ color: '#9FA3AC' }}>
                {countedCount}/{totalComponents} ({progressPercentage}%)
              </span>
              {isAdmin && countedCount > 0 && (
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
                  Reset
                </button>
              )}
            </div>
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
                Monthly count complete!
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

            {/* ✅ FIXED: Clean Dropdown - Removed extra "(Dual Tracked)" text */}
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
                  const isPriority = comp.is_high_volume;
                  
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
                          {isPriority && (
                            <span className="ml-2 px-2 py-1 rounded text-xs font-bold pointer-events-none" style={{ backgroundColor: '#00001C', color: '#86EFAC' }}>
                              PRIORITY
                            </span>
                          )}
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
                              Counted
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

        {/* ✅ FIXED: Clean Scan History Modal - Removed unnecessary dual tracking text */}
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
                  {selectedComponent.is_high_volume && (
                    <span className="ml-2 px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: '#86EFAC', color: '#00001C' }}>
                      PRIORITY ITEM - {priorityDays[selectedComponent.barcode]?.join(', ') || 'Loading...'}
                    </span>
                  )}
                </div>
              </div>
              
              {historyLoading ? (
                <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
                  Loading scan history...
                </div>
              ) : scanHistory.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
                  No scan history found for the last 90 days
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm" style={{ color: '#FAFCFB' }}>
                    Recent Scans ({scanHistory.length})
                  </h4>
                  {scanHistory.map((scan, index) => {
                    const isWeeklyScan = scan.count_type === 'priority' || scan.source?.includes('weekly');
                    const isMonthlyScan = scan.count_type === 'full' || scan.source?.includes('monthly');
                    const isDualTracked = scan.metadata?.dual_tracking === true;
                    
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
                              backgroundColor: isWeeklyScan ? '#86EFAC' : isMonthlyScan ? '#86EFAC' : '#39414E', 
                              color: '#00001C' 
                            }}>
                              {isDualTracked ? 'Priority Count' : isWeeklyScan ? 'Priority Count' : isMonthlyScan ? 'Monthly Count' : scan.count_type || 'Unknown'}
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

        {/* ✅ FIXED: Reset Confirmation Modal */}
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
                Reset Monthly Count
              </h3>
              
              <p className="text-sm mb-6" style={{ color: '#9FA3AC' }}>
                This will reset all monthly count progress for {selectedLocation}. 
                {countedCount} items will be marked as uncounted. This action cannot be undone.
                Note: Priority counts will remain unaffected.
              </p>
              
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
                  onClick={handleResetMonthlyCount}
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
                  {isLoading ? 'Resetting...' : 'Reset Count'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ FIXED: Clean Components List - Removed unnecessary dual tracking labels */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
              All Components ({totalComponents})
            </h3>
            
            {countedCount === totalComponents && totalComponents > 0 && (
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
                Complete Count
              </button>
            )}
          </div>

          {components.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
              <div className="text-lg mb-2">No components found</div>
              <div className="text-sm">Check your data or try refreshing</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {components.map((comp, index) => {
                const isCounted = countedComponents.has(comp.barcode);
                const isPriority = comp.is_high_volume;
                
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
                        {isPriority && (
                          <span className="ml-2 px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: '#86EFAC', color: '#00001C' }}>
                            PRIORITY
                          </span>
                        )}
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

export default FullCountManager;