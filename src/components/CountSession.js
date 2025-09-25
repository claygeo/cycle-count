// Enhanced CountSession.js - Added confirmation/rejection workflow for counts
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { localStorageManager, storageHelpers } from '../utils/LocalStorageManager';

const CountSession = ({ session: initialSession, onCountComplete, onCancelSession, onBack }) => {
  const [currentSku, setCurrentSku] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSkuData, setSelectedSkuData] = useState(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSupported, setCameraSupported] = useState(true);
  
  // NEW: Confirmation workflow state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingCount, setPendingCount] = useState(null);
  
  // FIXED: Add live session state that updates after each count
  const [liveSession, setLiveSession] = useState(initialSession);
  
  // Refs
  const skuInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);

  // FIXED: Update live session when initial session changes
  useEffect(() => {
    setLiveSession(initialSession);
  }, [initialSession]);

  // FIXED: Function to refresh session data from LocalStorage
  const refreshSession = useCallback(() => {
    const updatedSession = localStorageManager.getCurrentSession();
    if (updatedSession) {
      setLiveSession(updatedSession);
      console.log('✅ Session refreshed:', {
        totalItems: updatedSession.skus.length,
        countedItems: updatedSession.skus.filter(s => s.counted).length,
        progress: updatedSession.countProgress
      });
    }
  }, []);

  // Check camera support
  useEffect(() => {
    const checkCameraSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSupported(false);
        return;
      }
      
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setCameraSupported(false);
        return;
      }
      
      setCameraSupported(true);
    };
    
    checkCameraSupport();
  }, []);

  // Stop camera function
  const stopCamera = useCallback(() => {
    console.log('Stopping camera...');
    
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.offDetected();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error stopping Quagga:', error);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped video track:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setShowCamera(false);
    setIsScanning(false);
    setCameraError('');
  }, []);

  // Enhanced barcode scanner with better detection
  useEffect(() => {
    if (showCamera && videoRef.current && !scannerRef.current && cameraSupported) {
      const initializeScanner = async () => {
        try {
          const Quagga = (await import('quagga')).default;
          
          const config = {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: videoRef.current,
              constraints: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode: "environment",
                aspectRatio: { min: 1, max: 2 }
              }
            },
            locator: {
              patchSize: "medium",
              halfSample: true
            },
            numOfWorkers: 2,
            decoder: {
              readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader", 
                "code_39_reader",
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "i2of5_reader"
              ]
            },
            locate: true
          };

          console.log('Initializing Quagga scanner...');
          
          Quagga.init(config, (err) => {
            if (err) {
              console.error('Quagga initialization error:', err);
              setCameraError('Failed to initialize barcode scanner. Please try again.');
              return;
            }
            
            console.log('Quagga initialized successfully');
            Quagga.start();
            setIsScanning(true);
          });

          Quagga.onDetected((result) => {
            if (result && result.codeResult) {
              const code = result.codeResult.code;
              const confidence = result.codeResult.confidence || 0;
              
              console.log('Barcode detected:', code, 'Confidence:', confidence);
              
              if (confidence > 75) {
                console.log('High confidence scan accepted:', code);
                setCurrentSku(code);
                stopCamera();
                setStatus(`Barcode scanned: ${code}`);
                setStatusType('success');
                
                setTimeout(() => {
                  if (quantityInputRef.current) {
                    quantityInputRef.current.focus();
                  }
                }, 100);
              } else {
                console.log('Low confidence scan ignored:', code, confidence);
              }
            }
          });

          scannerRef.current = Quagga;
        } catch (error) {
          console.error('Error loading Quagga:', error);
          setCameraError('Barcode scanner library not available. Please enter codes manually.');
        }
      };

      initializeScanner();
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current.offDetected();
          scannerRef.current = null;
        } catch (error) {
          console.error('Error stopping scanner:', error);
        }
      }
    };
  }, [showCamera, cameraSupported, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    if (!cameraSupported) {
      setCameraError('Camera not supported on this device or insecure connection');
      return;
    }

    try {
      setCameraError('');
      setShowCamera(true);
      
      console.log('Requesting camera access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      });
      
      console.log('Camera access granted');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      let errorMessage = 'Camera access denied';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application.';
      }
      
      setCameraError(errorMessage);
      setShowCamera(false);
    }
  };

  useEffect(() => {
    if (status && statusType === 'success') {
      const timer = setTimeout(() => {
        setStatus('');
        setStatusType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, statusType]);

  // FIXED: Search using live session data instead of stale session prop
  useEffect(() => {
    if (currentSku.length >= 1 && liveSession) {
      const searchTerm = currentSku.toLowerCase().trim();
      const results = liveSession.skus.filter(sku => {
        return sku.sku.toLowerCase().includes(searchTerm) ||
               sku.barcode.toLowerCase().includes(searchTerm) ||
               (sku.alternateId && sku.alternateId.toLowerCase().includes(searchTerm)) ||
               (sku.description && sku.description.toLowerCase().includes(searchTerm));
      });
      
      setSearchResults(results.slice(0, 10));
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [currentSku, liveSession]);

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

  const handleSkuSelect = (sku) => {
    setCurrentSku(sku.sku);
    setSelectedSkuData(sku);
    setShowDropdown(false);
    
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }, 100);
  };

  // NEW: Modified count submission to show confirmation instead of immediately saving
  const handleSubmitCount = async () => {
    if (!currentSku || !currentQuantity) {
      setStatus('Please enter both SKU/Barcode and quantity');
      setStatusType('error');
      return;
    }

    const quantity = parseInt(currentQuantity);
    if (isNaN(quantity) || quantity < 0) {
      setStatus('Please enter a valid quantity (0 or greater)');
      setStatusType('error');
      return;
    }

    try {
      console.log('=== PREPARING COUNT FOR CONFIRMATION ===');
      console.log('Scanned input:', currentSku);

      // FIXED: Search in live session data
      let foundItem = liveSession.skus.find(sku => {
        const searchSku = currentSku.toLowerCase().trim();
        return sku.sku.toLowerCase() === searchSku ||
               sku.barcode.toLowerCase() === searchSku ||
               (sku.alternateId && sku.alternateId.toLowerCase() === searchSku);
      });
      
      if (!foundItem) {
        setStatus(`Item not found: "${currentSku}". Please check the SKU/Barcode.`);
        setStatusType('error');
        return;
      }

      console.log('✅ Found item for confirmation:', foundItem.sku, 'Quantity:', quantity);
      
      // Set up pending count for confirmation
      setPendingCount({
        item: foundItem,
        quantity: quantity,
        scannedInput: currentSku
      });
      
      setShowConfirmation(true);
      
    } catch (error) {
      console.error('Count preparation error:', error);
      setStatus(`Error: ${error.message}`);
      setStatusType('error');
    }
  };

  // NEW: Confirm the count and save it
  const handleConfirmCount = async () => {
    if (!pendingCount) return;
    
    try {
      console.log('=== CONFIRMING COUNT ===');
      const { item, quantity } = pendingCount;
      
      const result = localStorageManager.countSku(item.sku, quantity);
      
      if (result.success) {
        console.log('=== COUNT SUCCESS DEBUG ===');
        console.log('Result:', result);

        setStatus(`✓ Confirmed: ${item.sku} - Qty: ${quantity}`);
        setStatusType('success');
        
        // FIXED: Immediately refresh session to update progress
        refreshSession();
        
        // Clear all inputs and states
        setCurrentSku('');
        setCurrentQuantity('');
        setSelectedSkuData(null);
        setPendingCount(null);
        setShowConfirmation(false);
        
        setTimeout(() => {
          if (skuInputRef.current) {
            skuInputRef.current.focus();
          }
        }, 1500);
        
        // Check if session is complete
        const updatedStats = localStorageManager.getCountStatistics();
        if (updatedStats && updatedStats.percentage === 100) {
          setTimeout(() => {
            if (window.confirm('🎉 All items have been counted! Complete this session?')) {
              onCountComplete();
            }
          }, 2000);
        }
      } else {
        setStatus(`Error: ${result.error}`);
        setStatusType('error');
      }
    } catch (error) {
      console.error('Count confirmation error:', error);
      setStatus(`Error: ${error.message}`);
      setStatusType('error');
    }
  };

  // NEW: Reject the count and allow user to re-enter
  const handleRejectCount = () => {
    console.log('=== COUNT REJECTED ===');
    setStatus('Count rejected. Please re-enter the correct quantity.');
    setStatusType('error');
    
    // Clear confirmation but keep the scanned SKU and quantity for editing
    setPendingCount(null);
    setShowConfirmation(false);
    
    // Focus back to quantity input for correction
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
        quantityInputRef.current.select(); // Select all text for easy replacement
      }
    }, 100);
  };

  const handleKeyPress = (e, nextAction) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextAction();
    }
  };

  // FIXED: Calculate progress from live session data
  const remainingItems = liveSession ? liveSession.skus.filter(sku => !sku.counted).slice(0, 10) : [];
  const totalItems = liveSession ? liveSession.skus.length : 0;
  const countedItems = liveSession ? liveSession.skus.filter(sku => sku.counted).length : 0;
  const remainingCount = totalItems - countedItems;
  const progressPercentage = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  // Add debug logging for progress
  console.log('📊 Progress Debug:', {
    totalItems,
    countedItems,
    remainingCount,
    progressPercentage,
    sessionId: liveSession?.id
  });

  if (!liveSession) {
    return (
      <div className="px-4 py-6">
        <div className="text-center">
          <p style={{ color: '#9FA3AC' }}>Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#FAFCFB' }}>
            Count Session
          </h2>
          <p className="text-sm" style={{ color: '#9FA3AC' }}>
            {liveSession.uploadData?.filename || 'Unknown file'}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => storageHelpers.exportSessionAsCSV()}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ 
              backgroundColor: '#374051', 
              color: '#FAFCFB'
            }}
          >
            Export
          </button>
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ 
              backgroundColor: '#86EFAC', 
              color: '#00001C'
            }}
          >
            Dashboard
          </button>
        </div>
      </div>

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

      {/* FIXED: Live Progress Section */}
      <div 
        className="rounded-xl p-4 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium" style={{ color: '#FAFCFB' }}>
            Live Progress
          </span>
          <div className="flex items-center space-x-2">
            <span className="text-sm" style={{ color: '#9FA3AC' }}>
              {countedItems}/{totalItems} ({progressPercentage}%)
            </span>
            <button
              onClick={refreshSession}
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: '#86EFAC', color: '#00001C' }}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="h-2 rounded-full transition-all duration-500"
            style={{ 
              backgroundColor: '#86EFAC',
              width: `${progressPercentage}%` 
            }}
          />
        </div>
        {progressPercentage === 100 && (
          <div className="text-center mt-2 text-sm font-medium" style={{ color: '#86EFAC' }}>
            🎉 All items counted! Ready to complete.
          </div>
        )}
      </div>

      {/* Enhanced Count Input Section */}
      <div 
        className="rounded-xl p-4 shadow-sm border relative"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>
          Scan or Enter SKU/Barcode
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
              placeholder="Enter SKU, barcode, or scan with camera..."
              className="flex-1 px-4 py-3 rounded-lg border text-base pr-12 font-mono"
              style={{ 
                backgroundColor: '#15161B', 
                borderColor: '#39414E',
                color: '#FAFCFB'
              }}
              disabled={showConfirmation}
            />
            
            {cameraSupported && (
              <button
                onClick={startCamera}
                disabled={showCamera || !cameraSupported || showConfirmation}
                className="absolute right-3 p-2 rounded-lg transition-all"
                style={{ 
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: (showCamera || !cameraSupported || showConfirmation) ? 'not-allowed' : 'pointer',
                  opacity: (showCamera || !cameraSupported || showConfirmation) ? '0.5' : '1'
                }}
                title={cameraSupported ? "Scan barcode with camera" : "Camera not supported"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={cameraSupported ? "#86EFAC" : "#9FA3AC"}
                  strokeWidth="2"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && !showConfirmation && (
            <div 
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg z-10"
              style={{ 
                backgroundColor: '#86EFAC',
                borderColor: '#39414E' 
              }}
            >
              {searchResults.map((sku, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border-b cursor-pointer hover:bg-gray-600"
                  style={{ borderColor: '#00001C20' }}
                  onClick={() => handleSkuSelect(sku)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium font-mono" style={{ color: '#00001C' }}>
                      {sku.sku}
                    </div>
                    {sku.alternateId && sku.alternateId !== sku.sku && (
                      <div className="text-xs font-mono" style={{ color: '#00001C' }}>
                        Alt: {sku.alternateId}
                      </div>
                    )}
                    {sku.description && (
                      <div className="text-sm truncate" style={{ color: '#00001C' }}>
                        {sku.description}
                      </div>
                    )}
                    <div className="text-xs" style={{ color: '#00001C' }}>
                      Expected: {sku.expectedQuantity} • {sku.counted ? '✓ Counted' : 'Not Counted'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedSkuData && (
          <div 
            className="p-3 rounded-lg mb-4"
            style={{ backgroundColor: '#86EFAC20', borderColor: '#86EFAC', border: '1px solid' }}
          >
            <div className="text-sm font-medium font-mono" style={{ color: '#86EFAC' }}>
              Selected: {selectedSkuData.sku}
            </div>
            {selectedSkuData.alternateId && (
              <div className="text-xs font-mono" style={{ color: '#9FA3AC' }}>
                Alternate ID: {selectedSkuData.alternateId}
              </div>
            )}
            {selectedSkuData.description && (
              <div className="text-xs" style={{ color: '#9FA3AC' }}>
                {selectedSkuData.description}
              </div>
            )}
            <div className="text-xs" style={{ color: '#9FA3AC' }}>
              Expected Quantity: {selectedSkuData.expectedQuantity}
            </div>
          </div>
        )}

        <div className="mb-4">
          <input
            ref={quantityInputRef}
            type="number"
            value={currentQuantity}
            onChange={(e) => setCurrentQuantity(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, handleSubmitCount)}
            placeholder="Enter counted quantity..."
            min="0"
            step="1"
            className="w-full px-4 py-3 rounded-lg border text-base"
            style={{ 
              backgroundColor: '#15161B', 
              borderColor: '#39414E',
              color: '#FAFCFB'
            }}
            disabled={showConfirmation}
          />
        </div>

        {!showConfirmation ? (
          <button
            onClick={handleSubmitCount}
            disabled={!currentSku || !currentQuantity}
            className="w-full py-3 rounded-lg font-medium text-base"
            style={{ 
              backgroundColor: (!currentSku || !currentQuantity) ? '#39414E' : '#86EFAC',
              color: (!currentSku || !currentQuantity) ? '#9FA3AC' : '#00001C',
              border: 'none',
              cursor: (!currentSku || !currentQuantity) ? 'not-allowed' : 'pointer'
            }}
          >
            Review Count
          </button>
        ) : null}
      </div>

      {/* NEW: Count Confirmation Modal */}
      {showConfirmation && pendingCount && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-xl p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: '#181B22', border: '2px solid #86EFAC' }}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2" style={{ color: '#FAFCFB' }}>
                Confirm Count
              </h3>
              <p className="text-sm" style={{ color: '#9FA3AC' }}>
                Please review and confirm your count before proceeding
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              {/* Item Details */}
              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: '#15161B', border: '1px solid #39414E' }}
              >
                <div className="font-medium font-mono mb-1" style={{ color: '#86EFAC' }}>
                  {pendingCount.item.sku}
                </div>
                {pendingCount.item.alternateId && (
                  <div className="text-xs font-mono mb-1" style={{ color: '#9FA3AC' }}>
                    Alt: {pendingCount.item.alternateId}
                  </div>
                )}
                {pendingCount.item.description && (
                  <div className="text-sm mb-1" style={{ color: '#9FA3AC' }}>
                    {pendingCount.item.description}
                  </div>
                )}
                <div className="text-xs" style={{ color: '#9FA3AC' }}>
                  Expected: {pendingCount.item.expectedQuantity}
                </div>
              </div>

              {/* Count Details */}
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="p-3 rounded-lg text-center"
                  style={{ backgroundColor: '#15161B' }}
                >
                  <div className="text-xs mb-1" style={{ color: '#9FA3AC' }}>Expected</div>
                  <div className="text-xl font-bold" style={{ color: '#FAFCFB' }}>
                    {pendingCount.item.expectedQuantity}
                  </div>
                </div>
                <div 
                  className="p-3 rounded-lg text-center"
                  style={{ backgroundColor: '#86EFAC20', border: '1px solid #86EFAC' }}
                >
                  <div className="text-xs mb-1" style={{ color: '#86EFAC' }}>Your Count</div>
                  <div className="text-xl font-bold" style={{ color: '#86EFAC' }}>
                    {pendingCount.quantity}
                  </div>
                </div>
              </div>

              {/* Variance Indicator */}
              {pendingCount.quantity !== pendingCount.item.expectedQuantity && (
                <div 
                  className="p-3 rounded-lg text-center"
                  style={{ 
                    backgroundColor: Math.abs(pendingCount.quantity - pendingCount.item.expectedQuantity) > 5 ? '#FEE2E2' : '#FEF3C7',
                    border: `1px solid ${Math.abs(pendingCount.quantity - pendingCount.item.expectedQuantity) > 5 ? '#F87171' : '#F59E0B'}`,
                    color: Math.abs(pendingCount.quantity - pendingCount.item.expectedQuantity) > 5 ? '#B91C1C' : '#B45309'
                  }}
                >
                  <div className="text-sm font-medium">
                    Variance: {pendingCount.quantity > pendingCount.item.expectedQuantity ? '+' : ''}
                    {pendingCount.quantity - pendingCount.item.expectedQuantity}
                  </div>
                  {Math.abs(pendingCount.quantity - pendingCount.item.expectedQuantity) > 5 && (
                    <div className="text-xs mt-1">
                      Large variance detected - please double-check your count
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleRejectCount}
                className="flex-1 py-3 px-4 rounded-lg font-medium border transition-colors"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: '#F87171',
                  borderColor: '#F87171'
                }}
              >
                Reject & Re-enter
              </button>
              <button
                onClick={handleConfirmCount}
                className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C'
                }}
              >
                Confirm Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div 
            className="rounded-xl p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: '#181B22' }}
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
                  color: '#00001C'
                }}
              >
                ✕
              </button>
            </div>
            
            {cameraError ? (
              <div className="text-center py-8">
                <div className="text-red-400 mb-4">{cameraError}</div>
                <div className="text-sm text-gray-400 mb-4">
                  {cameraError.includes('permission') && (
                    <div>
                      <p>To enable camera access:</p>
                      <p>1. Click the camera icon in your browser's address bar</p>
                      <p>2. Select "Allow" for camera permissions</p>
                      <p>3. Refresh the page and try again</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C'
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
                  {isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="border-2 border-red-500 bg-transparent" 
                           style={{
                             width: '200px',
                             height: '60px',
                             opacity: 0.7
                           }}>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-sm mb-4" style={{ color: '#9FA3AC' }}>
                  {isScanning ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <div className="animate-pulse mr-2">📷</div>
                        Position barcode in the red box
                      </div>
                      <div className="text-xs">
                        Scanning for UPC, EAN, Code 128, and other formats...
                      </div>
                    </div>
                  ) : (
                    'Initializing camera scanner...'
                  )}
                </div>
                
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{ 
                    backgroundColor: '#86EFAC', 
                    color: '#00001C'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIXED: Remaining Items with live data */}
      <div 
        className="rounded-xl p-4 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
            Remaining Items ({remainingCount})
          </h3>
          
          {countedItems === totalItems && totalItems > 0 && (
            <button
              onClick={onCountComplete}
              className="px-4 py-2 rounded-lg font-medium text-sm animate-pulse"
              style={{ 
                backgroundColor: '#86EFAC', 
                color: '#00001C'
              }}
            >
              🎉 Complete Session
            </button>
          )}
        </div>

        {remainingItems.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#86EFAC' }}>
            <div className="text-lg mb-2">🎉 All items counted!</div>
            <div className="text-sm" style={{ color: '#9FA3AC' }}>
              Ready to complete this session
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {remainingItems.map((sku, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-800 transition-colors"
                style={{ 
                  backgroundColor: '#15161B', 
                  borderColor: '#39414E' 
                }}
                onClick={() => !showConfirmation && handleSkuSelect(sku)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium font-mono" style={{ color: '#FAFCFB' }}>
                    {sku.sku}
                  </div>
                  {sku.alternateId && sku.alternateId !== sku.sku && (
                    <div className="text-xs font-mono" style={{ color: '#9FA3AC' }}>
                      Alt: {sku.alternateId}
                    </div>
                  )}
                  {sku.description && (
                    <div className="text-sm truncate" style={{ color: '#9FA3AC' }}>
                      {sku.description}
                    </div>
                  )}
                  <div className="text-xs" style={{ color: '#9FA3AC' }}>
                    Expected: {sku.expectedQuantity}
                  </div>
                </div>
                
                <div className="px-3 py-1 rounded-lg text-sm" style={{ 
                  backgroundColor: '#374051', 
                  color: '#9FA3AC' 
                }}>
                  Count
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Actions */}
      <div className="flex space-x-3">
        <button
          onClick={() => storageHelpers.exportSessionAsCSV()}
          className="flex-1 py-3 px-4 rounded-lg font-medium border"
          style={{ 
            backgroundColor: 'transparent', 
            color: '#86EFAC',
            borderColor: '#86EFAC'
          }}
        >
          Export Progress ({countedItems}/{totalItems})
        </button>
        
        <button
          onClick={onCancelSession}
          className="px-4 py-3 rounded-lg font-medium border"
          style={{ 
            backgroundColor: 'transparent', 
            color: '#F87171',
            borderColor: '#F87171'
          }}
          disabled={showConfirmation}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CountSession;