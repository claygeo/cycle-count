// src/components/CountSession.js - Pure Frontend Count Interface (Fixed)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { localStorageManager, storageHelpers } from '../utils/LocalStorageManager';

const CountSession = ({ session, onCountComplete, onCancelSession, onBack }) => {
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
  
  // Refs
  const skuInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  
  // Get current session statistics
  const stats = localStorageManager.getCountStatistics();

  // Stop camera
  const stopCamera = useCallback(() => {
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
  }, []);

  // Auto-dismiss status messages
  useEffect(() => {
    if (status && statusType === 'success') {
      const timer = setTimeout(() => {
        setStatus('');
        setStatusType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, statusType]);

  // Search SKUs as user types
  useEffect(() => {
    if (currentSku.length >= 2) {
      const results = localStorageManager.searchSkus(currentSku, true);
      setSearchResults(results.slice(0, 10));
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [currentSku]);

  // Handle clicks outside dropdown
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

  // Camera cleanup - FIXED: Added stopCamera to dependency array
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start camera for barcode scanning
  const startCamera = async () => {
    try {
      setCameraError('');
      setShowCamera(true);
      
      // Dynamic import for QuaggaJS
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
            "code_39_reader",
            "upc_reader"
          ]
        }
      };

      Quagga.init(config, (err) => {
        if (err) {
          console.error('Camera initialization error:', err);
          setCameraError('Failed to initialize camera scanner');
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
      console.error('Error starting camera:', error);
      setCameraError('Camera not available on this device');
      setShowCamera(false);
    }
  };

  // Handle SKU selection
  const handleSkuSelect = (sku) => {
    setCurrentSku(sku.sku);
    setSelectedSkuData(sku);
    setShowDropdown(false);
    
    // Auto-focus quantity input
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }, 100);
  };

  // Handle count submission
  const handleSubmitCount = async () => {
    if (!currentSku || !currentQuantity) {
      setStatus('Please enter both SKU and quantity');
      setStatusType('error');
      return;
    }

    try {
      const result = localStorageManager.countSku(currentSku, currentQuantity);
      
      if (result.success) {
        setStatus(`Counted: ${currentSku} - Qty: ${currentQuantity}`);
        setStatusType('success');
        
        // Clear inputs
        setCurrentSku('');
        setCurrentQuantity('');
        setSelectedSkuData(null);
        
        // Focus back to SKU input
        setTimeout(() => {
          if (skuInputRef.current) {
            skuInputRef.current.focus();
          }
        }, 100);
        
        // Check if session is complete
        const updatedStats = localStorageManager.getCountStatistics();
        if (updatedStats && updatedStats.percentage === 100) {
          setTimeout(() => {
            if (window.confirm('All items have been counted! Complete this session?')) {
              onCountComplete();
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Count submission error:', error);
      setStatus(`Error: ${error.message}`);
      setStatusType('error');
    }
  };

  // Handle Enter key navigation
  const handleKeyPress = (e, nextAction) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextAction();
    }
  };

  // Get remaining items for quick access
  const remainingItems = session.skus.filter(sku => !sku.counted).slice(0, 10);

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#FAFCFB' }}>
            Count Session
          </h2>
          <p className="text-sm" style={{ color: '#9FA3AC' }}>
            {session.uploadData?.filename || 'Unknown file'}
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
            Progress
          </span>
          <span className="text-sm" style={{ color: '#9FA3AC' }}>
            {stats ? `${stats.counted}/${stats.total} (${stats.percentage}%)` : '0/0 (0%)'}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="h-2 rounded-full transition-all duration-300"
            style={{ 
              backgroundColor: '#86EFAC',
              width: `${stats ? stats.percentage : 0}%` 
            }}
          />
        </div>
      </div>

      {/* Count Input Section */}
      <div 
        className="rounded-xl p-4 shadow-sm border relative"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <h3 className="font-semibold mb-3" style={{ color: '#FAFCFB' }}>
          Count Item
        </h3>
        
        {/* SKU Input */}
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
              placeholder="Enter SKU or barcode..."
              className="flex-1 px-4 py-3 rounded-lg border text-base pr-12"
              style={{ 
                backgroundColor: '#15161B', 
                borderColor: '#39414E',
                color: '#FAFCFB'
              }}
            />
            
            {/* Camera Button */}
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
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#86EFAC"
                strokeWidth="2"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && searchResults.length > 0 && (
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
                    <div className="font-medium" style={{ color: '#00001C' }}>
                      {sku.sku}
                    </div>
                    {sku.description && (
                      <div className="text-sm truncate" style={{ color: '#00001C' }}>
                        {sku.description}
                      </div>
                    )}
                    <div className="text-xs" style={{ color: '#00001C' }}>
                      Expected: {sku.expectedQuantity} | {sku.counted ? 'Counted' : 'Not Counted'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected SKU Info */}
        {selectedSkuData && (
          <div 
            className="p-3 rounded-lg mb-4"
            style={{ backgroundColor: '#86EFAC20', borderColor: '#86EFAC', border: '1px solid' }}
          >
            <div className="text-sm font-medium" style={{ color: '#86EFAC' }}>
              Selected: {selectedSkuData.sku}
            </div>
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

        {/* Quantity Input */}
        <div className="mb-4">
          <input
            ref={quantityInputRef}
            type="number"
            value={currentQuantity}
            onChange={(e) => setCurrentQuantity(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, handleSubmitCount)}
            placeholder="Enter counted quantity..."
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
          disabled={!currentSku || !currentQuantity}
          className="w-full py-3 rounded-lg font-medium text-base"
          style={{ 
            backgroundColor: (!currentSku || !currentQuantity) ? '#39414E' : '#86EFAC',
            color: (!currentSku || !currentQuantity) ? '#9FA3AC' : '#00001C',
            border: 'none',
            cursor: (!currentSku || !currentQuantity) ? 'not-allowed' : 'pointer'
          }}
        >
          Count Item
        </button>
      </div>

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
                </div>
                
                <div className="text-sm mb-4" style={{ color: '#9FA3AC' }}>
                  {isScanning ? 'Position barcode in camera view' : 'Initializing camera...'}
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

      {/* Remaining Items Quick Access */}
      <div 
        className="rounded-xl p-4 shadow-sm border"
        style={{ 
          backgroundColor: '#181B22', 
          borderColor: '#39414E' 
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#FAFCFB' }}>
            Remaining Items ({remainingItems.length > 10 ? '10+' : remainingItems.length})
          </h3>
          
          {stats && stats.percentage === 100 && (
            <button
              onClick={onCountComplete}
              className="px-4 py-2 rounded-lg font-medium text-sm"
              style={{ 
                backgroundColor: '#86EFAC', 
                color: '#00001C'
              }}
            >
              Complete Session
            </button>
          )}
        </div>

        {remainingItems.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#86EFAC' }}>
            <div className="text-lg mb-2">All items counted!</div>
            <div className="text-sm" style={{ color: '#9FA3AC' }}>
              Ready to complete this session
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {remainingItems.map((sku, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-800"
                style={{ 
                  backgroundColor: '#15161B', 
                  borderColor: '#39414E' 
                }}
                onClick={() => handleSkuSelect(sku)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: '#FAFCFB' }}>
                    {sku.sku}
                  </div>
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
          Export Current Progress
        </button>
        
        <button
          onClick={onCancelSession}
          className="px-4 py-3 rounded-lg font-medium border"
          style={{ 
            backgroundColor: 'transparent', 
            color: '#F87171',
            borderColor: '#F87171'
          }}
        >
          Cancel Session
        </button>
      </div>
    </div>
  );
};

export default CountSession;