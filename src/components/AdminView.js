import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import { getLocationByCode } from '../config/theme';
import { 
  componentsAPI,
  cycleCountsAPI, 
  supabaseReplacementAPI,
  quantityHelpers
} from '../utils/api';
import auditLogger from '../utils/auditLogger'; // ✅ Added audit logger import

const AdminView = ({ userType, selectedLocation, user }) => {
  const [components, setComponents] = useState([]);
  const [cycleProgress, setCycleProgress] = useState({});
  const [countSources, setCountSources] = useState({});
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('');
  const [isCounting, setIsCounting] = useState(false);
  const barcodeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showAllSkus, setShowAllSkus] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get location info
  const locationInfo = getLocationByCode(selectedLocation);
  const locationName = locationInfo?.name || selectedLocation;

  // ✅ OPTIMIZED: Simplified tenant ID retrieval with error handling
  const getTenantId = useCallback(() => {
    if (!user) {
      return null;
    }

    const tenantId = user.tenantId || user.tenant_id;
    
    if (!tenantId || typeof tenantId !== 'string' || tenantId.length === 0) {
      console.error('Invalid tenant ID detected');
      return null;
    }
    
    return tenantId;
  }, [user]);

  // ✅ OPTIMIZED: Simplified count source retrieval
  const getCountSource = useCallback(async (sku) => {
    try {
      return await supabaseReplacementAPI.getLatestCountSource(sku, selectedLocation);
    } catch (error) {
      console.error('Error fetching count source:', error.message);
      return 'Error retrieving source';
    }
  }, [selectedLocation]);

  // ✅ OPTIMIZED: Streamlined component fetching with better error handling
  const fetchComponents = useCallback(async () => {
    const tenantId = getTenantId();
    
    if (!tenantId) {
      setStatus('Authentication error. Please log out and log in again.');
      setStatusColor('red');
      return;
    }

    setLoading(true);

    try {
      const data = await componentsAPI.getComponents();
      setComponents(data || []);

      // Batch count source requests for better performance
      const sources = {};
      const sourcePromises = (data || []).map(async (comp) => {
        const source = await getCountSource(comp.barcode);
        sources[comp.barcode] = source;
      });
      
      await Promise.all(sourcePromises);
      setCountSources(sources);
    } catch (error) {
      setStatus(`Error loading components: ${error.message}`);
      setStatusColor('red');
      console.error('AdminView fetchComponents error:', error);
    } finally {
      setLoading(false);
    }
  }, [getTenantId, getCountSource]);

  // ✅ OPTIMIZED: Simplified cycle progress loading
  const loadCycleProgress = useCallback(async () => {
    const tenantId = getTenantId();
    
    if (!tenantId) {
      return;
    }

    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    
    try {
      const cycleProgress = await supabaseReplacementAPI.getCycleCountProgress(cycleId, selectedLocation, 'admin');

      if (cycleProgress) {
        setCycleProgress(cycleProgress.progress || {});
        setIsCounting(!cycleProgress.completed);
      } else {
        setCycleProgress({});
        setIsCounting(false);
      }
    } catch (error) {
      setStatus(`Error loading progress: ${error.message}`);
      setStatusColor('red');
      console.error('AdminView loadCycleProgress error:', error);
    }
  }, [selectedLocation, getTenantId]);

  // ✅ OPTIMIZED: Effect with proper dependency management
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        await Promise.all([fetchComponents(), loadCycleProgress()]);
      };
      fetchData();
    }
  }, [selectedLocation, user, fetchComponents, loadCycleProgress]);

  // ✅ OPTIMIZED: Simplified admin view startup
  const startAdminView = async () => {
    const tenantId = getTenantId();
    
    if (!tenantId) {
      setStatus('Authentication error. Please log out and log in again.');
      setStatusColor('red');
      return;
    }

    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
    
    try {
      const existingCycleProgress = await supabaseReplacementAPI.getCycleCountProgress(cycleId, selectedLocation, 'admin');
      const existingProgress = existingCycleProgress ? existingCycleProgress.progress || {} : {};
      const updatedProgress = { ...existingProgress, ...cycleProgress };

      await supabaseReplacementAPI.upsertCycleCount(
        cycleId,
        selectedLocation,
        'admin',
        updatedProgress,
        false,
        existingCycleProgress?.start_date
      );
      
      setIsCounting(true);
      setCycleProgress(updatedProgress);
      setStatus(`Started admin view for ${locationName}.`);
      setStatusColor('green');

      // ✅ ADDED: Log cycle count start
      await auditLogger.logCycleCountAction(
        selectedLocation, 
        'admin_view_started', 
        false, 
        { 
          cycle_id: cycleId,
          existing_progress_count: Object.keys(existingProgress).length,
          total_components: components.length
        }
      );
      
    } catch (error) {
      setStatus(`Error starting admin view: ${error.message}`);
      setStatusColor('red');
      console.error('AdminView startAdminView error:', error);
    }
  };

  // ✅ OPTIMIZED: Simplified reset functionality
  const resetCycleCount = async () => {
    if (!window.confirm(`Are you sure you want to reset the cycle count for ${locationName}? This will clear all progress for this month.`)) {
      return;
    }

    const tenantId = getTenantId();
    
    if (!tenantId) {
      setStatus('Authentication error.');
      setStatusColor('red');
      return;
    }

    const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;

    try {
      await cycleCountsAPI.deleteCycleCount(cycleId);

      setCycleProgress({});
      setCountSources({});
      setIsCounting(false);
      setStatus(`Cycle count for ${locationName} has been reset.`);
      setStatusColor('green');
      await fetchComponents();

      // ✅ ADDED: Log cycle count reset
      await auditLogger.logCycleCountAction(
        selectedLocation, 
        'admin_view_reset', 
        false, 
        { 
          cycle_id: cycleId,
          reset_by: user?.email || 'unknown'
        }
      );
      
    } catch (error) {
      setStatus(`Error resetting cycle count: ${error.message}`);
      setStatusColor('red');
      console.error('AdminView resetCycleCount error:', error);
    }
  };

  // ✅ OPTIMIZED: Streamlined scan handling with better performance + AUDIT LOGGING
  const handleScan = useCallback(async (e) => {
    e.preventDefault();
    
    if (!barcode) {
      setStatus('Please enter a barcode.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    if (quantity === '') {
      setStatus('Please enter a quantity.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    if (!selectedLocation) {
      setStatus('No location selected. Please select a location.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    const tenantId = getTenantId();
    
    if (!tenantId) {
      setStatus('Authentication error. Please log out and log in again.');
      setStatusColor('red');
      setShowNextButton(true);
      return;
    }

    try {
      const component = await supabaseReplacementAPI.getComponentByBarcode(barcode);
      const enteredQuantity = parseInt(quantity, 10);
      const actualQuantity = component ? quantityHelpers.getLocationQuantity(component, selectedLocation) : 0;

      if (actualQuantity !== enteredQuantity) {
        setStatus(`Quantity mismatch. Expected: ${actualQuantity}, Entered: ${enteredQuantity}. Please recount.`);
        setStatusColor('red');
        setShowNextButton(true);

        // ✅ ADDED: Log failed scan attempt
        await auditLogger.logInventoryScan(
          barcode, 
          enteredQuantity, 
          selectedLocation, 
          'admin_view_mismatch',
          {
            expected_quantity: actualQuantity,
            entered_quantity: enteredQuantity,
            scan_status: 'quantity_mismatch'
          }
        );

        return;
      }

      // Update component quantity
      await componentsAPI.updateQuantity(barcode, enteredQuantity, selectedLocation);

      const cycleId = `Cycle_${new Date().toISOString().slice(0, 7)}_${selectedLocation}`;
      const now = DateTime.now().setZone('UTC');
      const newCycleProgress = { ...cycleProgress, [barcode]: enteredQuantity };

      // Update cycle count progress
      const existingCycleProgress = await supabaseReplacementAPI.getCycleCountProgress(cycleId, selectedLocation, 'admin');

      await supabaseReplacementAPI.upsertCycleCount(
        cycleId,
        selectedLocation,
        'admin',
        newCycleProgress,
        Object.keys(newCycleProgress).length === components.length,
        existingCycleProgress?.start_date
      );

      setCycleProgress(newCycleProgress);

      // Log count action using legacy system (for compatibility)
      const source = `Counted on ${now.toFormat('MM/dd/yyyy')} at ${now.toFormat('hh:mm:ss a')} using the Admin View at ${locationName}`;
      
      await supabaseReplacementAPI.insertCountHistory(
        barcode, 
        enteredQuantity, 
        'admin', 
        cycleId, 
        userType, 
        source, 
        selectedLocation
      );

      // ✅ ADDED: Log successful scan using audit logger
      await auditLogger.logInventoryScan(
        barcode, 
        enteredQuantity, 
        selectedLocation, 
        'admin_view_scan',
        {
          cycle_id: cycleId,
          scan_status: 'successful',
          description: component?.description || `SKU ${barcode}`,
          progress_count: Object.keys(newCycleProgress).length,
          total_components: components.length,
          is_complete: Object.keys(newCycleProgress).length === components.length
        }
      );

      // Update count source
      const updatedSource = await getCountSource(barcode);
      setCountSources((prev) => ({ ...prev, [barcode]: updatedSource }));

      setStatus(`Successfully counted ${barcode} at ${locationName}!`);
      setStatusColor('green');
      setShowNextButton(true);

      // Refresh components in background
      fetchComponents();

      // ✅ ADDED: Log completion if this was the last item
      if (Object.keys(newCycleProgress).length === components.length) {
        await auditLogger.logCycleCountAction(
          selectedLocation, 
          'admin_view_completed', 
          true, 
          { 
            cycle_id: cycleId,
            total_scanned: Object.keys(newCycleProgress).length,
            completion_time: now.toISO()
          }
        );
      }

    } catch (error) {
      setStatus(`Error updating quantity: ${error.message}`);
      setStatusColor('red');
      setShowNextButton(true);
      console.error('AdminView handleScan error:', error);

      // ✅ ADDED: Log scan error
      await auditLogger.logInventoryScan(
        barcode, 
        quantity, 
        selectedLocation, 
        'admin_view_error',
        {
          error_message: error.message,
          scan_status: 'error'
        }
      );
    }
  }, [barcode, quantity, selectedLocation, getTenantId, cycleProgress, components.length, fetchComponents, getCountSource, userType, locationName, user]);

  // ✅ OPTIMIZED: Simplified navigation handlers
  const handleNext = useCallback(() => {
    setBarcode('');
    setQuantity('');
    setStatus('');
    setStatusColor('');
    setShowNextButton(false);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const handleBarcodeKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && barcode) {
      e.preventDefault();
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
      }
    }
  }, [barcode]);

  const handleQuantityKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && quantity !== '') {
      e.preventDefault();
      handleScan(e);
    }
  }, [quantity, handleScan]);

  const toggleShowAllSkus = useCallback(() => {
    setShowAllSkus(!showAllSkus);
  }, [showAllSkus]);

  // Show loading if user data isn't available
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading user information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            👑 Admin View - {locationName}
          </h2>

          {loading && (
            <div className="text-center mb-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-700 mt-2">Loading components and progress...</p>
            </div>
          )}

          {!isCounting && !loading && (
            <div className="text-center mb-6">
              <button
                onClick={startAdminView}
                className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-all w-full max-w-md shadow-sm font-medium"
              >
                {Object.keys(cycleProgress).length > 0 ? 'Resume Admin View' : 'Start Admin View'}
              </button>
            </div>
          )}

          {isCounting && (
            <>
              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">
                  Progress: {Object.keys(cycleProgress).length}/{components.length} SKUs Counted
                </label>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                    style={{ width: `${(Object.keys(cycleProgress).length / (components.length || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">SKUs to Count:</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-2">
                    {(showAllSkus ? components : components.slice(0, 5)).map((comp) => (
                      <li
                        key={comp.barcode}
                        className={`flex items-center justify-between p-2 rounded ${
                          cycleProgress[comp.barcode] !== undefined 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-white text-gray-700'
                        }`}
                      >
                        {/* ✅ FIXED: Display SKU ID instead of barcode */}
                        <span className="font-mono font-medium">{comp.id}</span>
                        <div className="text-sm">
                          <span>
                            {cycleProgress[comp.barcode] !== undefined
                              ? `Counted: ${cycleProgress[comp.barcode]}`
                              : `Expected: ${quantityHelpers.getLocationQuantity(comp, selectedLocation)}`}
                          </span>
                          {countSources[comp.barcode] && (
                            <div className="text-xs text-gray-500 italic mt-1">
                              {countSources[comp.barcode]}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {components.length > 5 && (
                    <button 
                      onClick={toggleShowAllSkus} 
                      className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {showAllSkus ? 'Show Less' : `Show All ${components.length} SKUs`}
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleScan} className="space-y-6">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Scan Barcode:</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyPress={handleBarcodeKeyPress}
                    ref={barcodeInputRef}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    placeholder="Scan or enter barcode"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Quantity:</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyPress={handleQuantityKeyPress}
                    ref={quantityInputRef}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    placeholder="Enter quantity"
                  />
                </div>
                {!showNextButton && (
                  <div className="text-center">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-all w-full max-w-md shadow-sm font-medium"
                    >
                      Submit Count
                    </button>
                  </div>
                )}
              </form>

              {showNextButton && (
                <div className="text-center mt-6">
                  <button
                    onClick={handleNext}
                    className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-all w-full max-w-md shadow-sm font-medium"
                  >
                    Next Item
                  </button>
                </div>
              )}

              <div className="text-center mt-6">
                <button
                  onClick={resetCycleCount}
                  className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition-all w-full max-w-md shadow-sm font-medium"
                >
                  Reset Cycle Count
                </button>
              </div>
            </>
          )}

          {status && (
            <div className={`mt-6 p-4 rounded-lg text-center ${
              statusColor === 'red' ? 'bg-red-50 text-red-800 border border-red-200' : 
              statusColor === 'green' ? 'bg-green-50 text-green-800 border border-green-200' : 
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <p className="font-medium">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;