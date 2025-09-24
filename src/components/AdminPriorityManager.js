import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseReplacementAPI, adminUtils, priorityAPI } from '../utils/api';

const AdminPriorityManager = ({ selectedLocation, user, onBack }) => {
  // ✅ All hooks at the top
  const [components, setComponents] = useState([]);
  const [priorityComponents, setPriorityComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [filteredComponents, setFilteredComponents] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [stats, setStats] = useState({
    totalComponents: 0,
    priorityComponents: 0
  });
  
  // ✅ NEW: Camera/Scanner state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSupported, setCameraSupported] = useState(true);

  // Refs for dropdown and camera functionality
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scannerRef = useRef(null);

  const daysOfWeek = [
    { value: 'Monday', label: 'Mon' },
    { value: 'Tuesday', label: 'Tue' },
    { value: 'Wednesday', label: 'Wed' },
    { value: 'Thursday', label: 'Thu' },
    { value: 'Friday', label: 'Fri' }
  ];

  // ✅ Stop camera function - defined early to avoid dependency issues
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

  // ✅ Check camera support on component mount
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

  // ✅ Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (status && statusType === 'success') {
      const timer = setTimeout(() => {
        setStatus('');
        setStatusType('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, statusType]);

  // ✅ Initialize barcode scanner when camera is shown
  useEffect(() => {
    const initializeScanner = async () => {
      if (showCamera && videoRef.current && !scannerRef.current) {
        try {
          // Dynamic import for QuaggaJS (barcode scanner library)
          const Quagga = await import('quagga');
          
          const config = {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: videoRef.current,
              constraints: {
                width: 320,
                height: 240,
                facingMode: "environment" // Use back camera on mobile
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
            
            console.log('✅ Barcode scanner initialized');
            Quagga.start();
            setIsScanning(true);
            
            // Handle successful barcode detection
            Quagga.onDetected((result) => {
              if (result && result.codeResult && result.codeResult.code) {
                const barcode = result.codeResult.code;
                console.log('📷 Barcode detected:', barcode);
                
                // Fill the search input with detected barcode
                setSearchTerm(barcode);
                
                // Close camera
                stopCamera();
                
                // Show success message
                setStatus(`Barcode scanned: ${barcode}`);
                setStatusType('success');
                
                // Focus back on search input
                if (searchRef.current) {
                  searchRef.current.focus();
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

  // ✅ Start camera function
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

  // ✅ Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Fetch all components and priority status
  const fetchComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const allComponents = await supabaseReplacementAPI.getComponentsWithCountStatus(selectedLocation, 'monthly');
      
      // Get priority components for the selected day
      const priorityData = await priorityAPI.getPriorityForDay(selectedDay, selectedLocation);
      const priorityItems = priorityData?.components || [];
      
      setComponents(allComponents || []);
      setPriorityComponents(priorityItems);
      
      setStats({
        totalComponents: allComponents?.length || 0,
        priorityComponents: priorityItems?.length || 0
      });

    } catch (error) {
      console.error('Error fetching components:', error);
      setStatus(`Error loading components: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation, selectedDay]);

  // Filter components based on search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const filtered = components.filter(comp =>
        comp.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.description?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 20); // Limit for performance
      setFilteredComponents(filtered);
      setShowDropdown(true);
    } else {
      setFilteredComponents([]);
      setShowDropdown(false);
    }
  }, [searchTerm, components]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load data when day changes
  useEffect(() => {
    if (user) {
      fetchComponents();
    }
  }, [user, selectedDay, fetchComponents]);

  // Check admin permissions AFTER all hooks
  const isAdmin = adminUtils.isAdmin(user);
  
  // Check if component is already assigned to the selected day
  const isComponentInPriority = (barcode) => {
    return priorityComponents.some(comp => comp.barcode === barcode);
  };

  // Toggle priority status for a component with day assignment
  const togglePriority = async (barcode, isCurrentlyPriority) => {
    try {
      setIsLoading(true);
      
      if (isCurrentlyPriority) {
        // Remove from priority for this specific day
        await priorityAPI.removeFromPriority(barcode, selectedDay, selectedLocation);
        setStatus(`Removed ${barcode} from priority list for ${selectedDay}`);
      } else {
        // Add to priority for this specific day
        await priorityAPI.addToPriority(barcode, selectedDay, selectedLocation);
        setStatus(`Added ${barcode} to priority list for ${selectedDay}`);
      }
      
      setStatusType('success');
      
      // Hide dropdown and clear search after adding/removing
      setShowDropdown(false);
      setSearchTerm('');
      
      // Refresh the data
      await fetchComponents();
      
    } catch (error) {
      console.error('Error toggling priority:', error);
      if (error.message.includes('already assigned')) {
        setStatus(`${barcode} is already assigned to priority for ${selectedDay}`);
        setStatusType('error');
      } else {
        setStatus(`Error updating priority status: ${error.message}`);
        setStatusType('error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Remove all priority items for the selected day
  const clearDayPriority = async () => {
    if (!window.confirm(`Remove ALL ${priorityComponents.length} items from priority list for ${selectedDay}?`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Remove each priority component for this day
      const removePromises = priorityComponents.map(comp => 
        priorityAPI.removeFromPriority(comp.barcode, selectedDay, selectedLocation)
      );
      
      await Promise.allSettled(removePromises);
      
      setStatus(`Cleared all priority items for ${selectedDay}`);
      setStatusType('success');
      
      await fetchComponents();
      
    } catch (error) {
      setStatus(`Error clearing priority items: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear ALL priority items (all days)
  const clearAllPriority = async () => {
    if (!window.confirm(`Remove ALL priority items from ALL days? This cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      await supabaseReplacementAPI.clearAllPriorityItems();
      
      setStatus('Cleared all priority items from all days');
      setStatusType('success');
      
      await fetchComponents();
      
    } catch (error) {
      setStatus(`Error clearing all priority items: ${error.message}`);
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle selecting an item from dropdown
  const handleSelectFromDropdown = (component) => {
    setShowDropdown(false);
    setSearchTerm('');
  };

  // Handle day selection change
  const handleDayChange = (day) => {
    setSelectedDay(day);
    // Clear any status messages when changing days
    setStatus('');
    setStatusType('');
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#15161B' }}>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4" style={{ color: '#FAFCFB' }}>
            Access Denied
          </h2>
          <p className="mb-6" style={{ color: '#9FA3AC' }}>
            Admin access required to manage priority SKUs
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg font-medium"
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
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#15161B' }}>
      {/* ✅ Header - Swapped button positions */}
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
          
          <h1 className="text-lg font-bold" style={{ color: '#FAFCFB' }}>
            Setup Priority Count
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
        {/* Status Message - Only show success and error messages */}
        {status && statusType !== 'info' && (
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

        {/* Day Selection */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>
            Select Day
          </h3>
          <div className="flex space-x-2 overflow-x-auto">
            {daysOfWeek.map((day) => (
              <button
                key={day.value}
                onClick={() => handleDayChange(day.value)}
                className="px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
                style={{ 
                  backgroundColor: selectedDay === day.value ? '#86EFAC' : '#39414E',
                  color: selectedDay === day.value ? '#00001C' : '#FAFCFB',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards - Only 2 cards */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            className="rounded-xl p-4 shadow-sm border"
            style={{ 
              backgroundColor: '#181B22', 
              borderColor: '#39414E' 
            }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#FAFCFB' }}>
                {stats.totalComponents}
              </div>
              <div className="text-sm" style={{ color: '#9FA3AC' }}>
                Total SKUs
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
              <div className="text-2xl font-bold" style={{ color: '#FAFCFB' }}>
                {stats.priorityComponents}
              </div>
              <div className="text-sm" style={{ color: '#9FA3AC' }}>
                Priority SKUs ({selectedDay})
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Compact Search Section with Camera Scanner */}
        <div 
          className="rounded-xl p-4 shadow-sm border relative"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>
            Search & Add SKUs for {selectedDay}
          </h3>
          
          <div className="relative">
            <div className="flex items-center">
              <input
                ref={searchRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (filteredComponents.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                placeholder="Search by SKU, barcode, or description..."
                className="flex-1 px-4 py-3 rounded-lg border text-base pr-12"
                style={{ 
                  backgroundColor: '#15161B', 
                  borderColor: '#39414E',
                  color: '#FAFCFB'
                }}
              />
              
              {/* ✅ Camera Scanner Button */}
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
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              )}
            </div>

            {/* ✅ COMPLETELY FIXED: Dropdown with CSS-only hover using standard classes */}
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
                  const isInPriority = isComponentInPriority(comp.barcode);
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border-b cursor-pointer transition-colors duration-200 hover:bg-gray-600"
                      style={{ 
                        borderColor: '#00001C20',
                        backgroundColor: 'transparent'
                      }}
                      onClick={() => handleSelectFromDropdown(comp)}
                    >
                      <div className="flex-1 min-w-0 pointer-events-none">
                        <div className="font-medium pointer-events-none" style={{ color: '#00001C' }}>
                          {comp.id} • {comp.barcode}
                        </div>
                        {comp.description && (
                          <div className="text-sm truncate pointer-events-none" style={{ color: '#00001C' }}>
                            {comp.description}
                          </div>
                        )}
                        <div className="text-xs pointer-events-none" style={{ color: '#00001C' }}>
                          Qty: {comp.primary_quantity || 0}
                          {isInPriority && (
                            <span className="ml-2 px-2 py-1 rounded text-xs font-bold pointer-events-none" style={{ backgroundColor: '#00001C', color: '#86EFAC' }}>
                              Priority ({selectedDay})
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        className="px-4 py-2 rounded-lg font-medium text-sm min-w-[80px] pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePriority(comp.barcode, isInPriority);
                        }}
                        disabled={isLoading}
                        style={{ 
                          backgroundColor: '#00001C', 
                          color: '#86EFAC',
                          border: 'none',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? '0.5' : '1'
                        }}
                      >
                        {isInPriority ? 'Remove' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results message */}
            {searchTerm.length > 0 && filteredComponents.length === 0 && !showDropdown && (
              <div className="mt-4 text-center py-4" style={{ color: '#9FA3AC' }}>
                No components found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>

        {/* ✅ Camera Scanner Modal */}
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

        {/* Current Priority SKUs for Selected Day */}
        <div 
          className="rounded-xl p-4 shadow-sm border"
          style={{ 
            backgroundColor: '#181B22', 
            borderColor: '#39414E' 
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
              Priority SKUs for {selectedDay} ({priorityComponents.length})
            </h3>
            
            {/* ✅ All buttons now use mint green */}
            <div className="flex space-x-2">
              {priorityComponents.length > 0 && (
                <button
                  onClick={clearDayPriority}
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg font-medium text-sm"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C',
                    border: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? '0.5' : '1'
                  }}
                >
                  Clear {selectedDay}
                </button>
              )}
              
              <button
                onClick={clearAllPriority}
                disabled={isLoading}
                className="px-3 py-2 rounded-lg font-medium text-sm"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? '0.5' : '1'
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          {priorityComponents.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#9FA3AC' }}>
              <div className="text-lg mb-2">No priority SKUs for {selectedDay}</div>
              <div className="text-sm">Use the search above to add items to the priority list</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {priorityComponents.map((comp, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ 
                    backgroundColor: '#15161B', 
                    borderColor: '#39414E' 
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ color: '#FAFCFB' }}>
                      {comp.id} • {comp.barcode}
                    </div>
                    {comp.description && (
                      <div className="text-sm truncate" style={{ color: '#9FA3AC' }}>
                        {comp.description}
                      </div>
                    )}
                    <div className="text-xs" style={{ color: '#9FA3AC' }}>
                      Qty: {comp.primary_quantity || 0}
                      {comp.last_counted_date && (
                        <span className="ml-2">
                          • Last counted: {new Date(comp.last_counted_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* ✅ Remove button now uses mint green */}
                  <button
                    onClick={() => togglePriority(comp.barcode, true)}
                    disabled={isLoading}
                    className="px-3 py-1 rounded-lg font-medium text-sm"
                    style={{ 
                      backgroundColor: '#86EFAC', 
                      color: '#00001C',
                      border: 'none',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      opacity: isLoading ? '0.5' : '1'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPriorityManager;