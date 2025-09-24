import React, { useState, useEffect } from 'react';
import { getLocationByCode, quantityFieldMap } from '../config/theme';
import { componentsAPI, labelsAPI, utils } from '../utils/api';
import auditLogger from '../utils/auditLogger'; // ✅ Enhanced audit logging

const PrintSettings = ({ selectedLocation }) => {
  const [components, setComponents] = useState([]);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [labelSize, setLabelSize] = useState('4x1.5');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingComponents, setFetchingComponents] = useState(true);
  const [sortBy, setSortBy] = useState('barcode'); // barcode, description, quantity
  const [showOnlyWithQuantity, setShowOnlyWithQuantity] = useState(false);

  // Get location info
  const locationInfo = getLocationByCode(selectedLocation);
  const locationName = locationInfo?.name || selectedLocation;
  const quantityField = quantityFieldMap[selectedLocation] || 'primary_quantity';

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    if (!utils.isAuthenticated()) {
      setStatus('❌ Not authenticated. Please log in again.');
      setFetchingComponents(false);
      return;
    }

    try {
      setFetchingComponents(true);
      setStatus('Loading components...');
      
      // ✅ ADDED: Log component fetch for audit
      await auditLogger.logInventoryScan(
        'SYSTEM_FETCH',
        0,
        selectedLocation,
        'print_settings_component_fetch',
        {
          fetch_type: 'components_for_label_printing',
          location: selectedLocation
        }
      );

      const data = await componentsAPI.getComponents();
      setComponents(data || []);
      setStatus(`✅ Loaded ${data?.length || 0} components`);
      
      // Clear status after 3 seconds
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Error fetching components:', error);
      setStatus(`❌ Error loading components: ${error.message}`);

      // ✅ ADDED: Log fetch error
      await auditLogger.logInventoryScan(
        'SYSTEM_FETCH_ERROR',
        0,
        selectedLocation,
        'print_settings_fetch_error',
        {
          error_message: error.message,
          fetch_type: 'components_for_label_printing'
        }
      );
    } finally {
      setFetchingComponents(false);
    }
  };

  const handleSelectComponent = async (barcode) => {
    const isCurrentlySelected = selectedComponents.includes(barcode);
    
    if (isCurrentlySelected) {
      setSelectedComponents((prev) => prev.filter((compId) => compId !== barcode));
      
      // ✅ ADDED: Log component deselection
      await auditLogger.logInventoryScan(
        barcode,
        0,
        selectedLocation,
        'print_settings_component_deselected',
        {
          action: 'deselect_for_printing',
          remaining_selected: selectedComponents.length - 1
        }
      );
    } else {
      setSelectedComponents((prev) => [...prev, barcode]);
      
      // ✅ ADDED: Log component selection
      await auditLogger.logInventoryScan(
        barcode,
        0,
        selectedLocation,
        'print_settings_component_selected',
        {
          action: 'select_for_printing',
          total_selected: selectedComponents.length + 1
        }
      );
    }
  };

  const handleSelectAll = async () => {
    const visibleBarcodes = getFilteredAndSortedComponents().map(comp => comp.barcode);
    setSelectedComponents(visibleBarcodes);

    // ✅ ADDED: Log select all action
    await auditLogger.logInventoryScan(
      'BULK_SELECT',
      visibleBarcodes.length,
      selectedLocation,
      'print_settings_select_all',
      {
        action: 'select_all_visible',
        components_selected: visibleBarcodes.length,
        search_term: searchTerm,
        sort_by: sortBy,
        show_only_with_quantity: showOnlyWithQuantity
      }
    );
  };

  const handleClearSelection = async () => {
    const previousCount = selectedComponents.length;
    setSelectedComponents([]);

    // ✅ ADDED: Log clear selection action
    await auditLogger.logInventoryScan(
      'BULK_CLEAR',
      previousCount,
      selectedLocation,
      'print_settings_clear_selection',
      {
        action: 'clear_all_selected',
        components_cleared: previousCount
      }
    );
  };

  // ✅ ADDED: Log search actions
  const handleSearchChange = async (value) => {
    setSearchTerm(value);
    
    // Only log meaningful searches (3+ characters)
    if (value.length >= 3 && value !== searchTerm) {
      await auditLogger.logInventoryScan(
        'SEARCH_QUERY',
        value.length,
        selectedLocation,
        'print_settings_search',
        {
          search_term: value,
          search_length: value.length,
          action: 'component_search'
        }
      );
    }
  };

  // ✅ ADDED: Log sort actions
  const handleSortChange = async (newSortBy) => {
    const oldSortBy = sortBy;
    setSortBy(newSortBy);

    await auditLogger.logConfigurationChange(
      'print_settings_sort',
      oldSortBy,
      newSortBy,
      {
        component_count: components.length,
        selected_count: selectedComponents.length
      }
    );
  };

  // ✅ ADDED: Log filter actions
  const handleFilterChange = async (showOnlyWithQty) => {
    const oldValue = showOnlyWithQuantity;
    setShowOnlyWithQuantity(showOnlyWithQty);

    await auditLogger.logConfigurationChange(
      'print_settings_filter',
      oldValue,
      showOnlyWithQty,
      {
        filter_type: 'show_only_with_quantity',
        component_count: components.length
      }
    );
  };

  // ✅ ADDED: Log label size changes
  const handleLabelSizeChange = async (newSize) => {
    const oldSize = labelSize;
    setLabelSize(newSize);

    await auditLogger.logConfigurationChange(
      'print_settings_label_size',
      oldSize,
      newSize,
      {
        selected_components: selectedComponents.length
      }
    );
  };

  const getFilteredAndSortedComponents = () => {
    let filtered = components.filter(comp => {
      // Search filter
      const matchesSearch = !searchTerm || 
        comp.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp.description && comp.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Quantity filter
      const hasQuantity = !showOnlyWithQuantity || (comp[quantityField] > 0);
      
      return matchesSearch && hasQuantity;
    });

    // Sort components
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'description':
          return (a.description || '').localeCompare(b.description || '');
        case 'quantity':
          return (b[quantityField] || 0) - (a[quantityField] || 0);
        case 'barcode':
        default:
          return a.barcode.localeCompare(b.barcode);
      }
    });

    return filtered;
  };

  const handlePrint = async () => {
    if (selectedComponents.length === 0) {
      setStatus('❌ Please select at least one component to print.');
      return;
    }

    if (!utils.isAuthenticated()) {
      setStatus('❌ Not authenticated. Please log in again.');
      return;
    }

    setLoading(true);
    setStatus('🖨️ Generating labels...');

    try {
      // ✅ ENHANCED: Log label generation start with more details
      await auditLogger.logLabelGeneration(
        selectedComponents.length,
        {
          location: selectedLocation,
          label_size: labelSize,
          status: 'generation_started',
          selected_component_count: selectedComponents.length,
          total_available_components: components.length,
          search_term: searchTerm,
          sort_by: sortBy,
          show_only_with_quantity: showOnlyWithQuantity
        }
      );

      // Get selected components with their data
      const selectedComponentsData = components
        .filter((comp) => selectedComponents.includes(comp.barcode))
        .map(comp => ({
          id: comp.barcode,
          barcode: comp.barcode,
          description: comp.description || 'No Description',
          quantity: comp[quantityField] || 0,
        }));

      // Parse label size
      const [width, height] = labelSize.split('x').map(Number);
      
      // Generate labels using backend API
      const labelBlob = await labelsAPI.generateLabels(selectedComponentsData, {
        includeId: true,
        labelSize: { width, height }
      });

      // Download the generated PDF
      const url = window.URL.createObjectURL(labelBlob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `selected_labels_${selectedLocation}_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus(`✅ Successfully generated ${selectedComponentsData.length} labels!`);

      // ✅ ENHANCED: Log successful label generation with comprehensive details
      await auditLogger.logLabelGeneration(
        selectedComponentsData.length,
        {
          location: selectedLocation,
          label_size: labelSize,
          status: 'generation_completed',
          pdf_filename: fileName,
          components_printed: selectedComponentsData.map(comp => ({
            barcode: comp.barcode,
            description: comp.description,
            quantity: comp.quantity
          })),
          total_quantity_on_labels: selectedComponentsData.reduce((sum, comp) => sum + comp.quantity, 0),
          label_dimensions: { width, height },
          include_id: true
        }
      );

      // ✅ ADDED: Log individual component printing for detailed audit trail
      for (const comp of selectedComponentsData) {
        await auditLogger.logInventoryScan(
          comp.barcode,
          comp.quantity,
          selectedLocation,
          'label_printed',
          {
            description: comp.description,
            label_size: labelSize,
            pdf_filename: fileName,
            print_batch_size: selectedComponentsData.length
          }
        );
      }
      
      // Clear selection after successful print
      setSelectedComponents([]);
      
      // Clear status after 5 seconds
      setTimeout(() => setStatus(''), 5000);
      
    } catch (error) {
      console.error('Print error:', error);
      setStatus(`❌ Error generating labels: ${error.message}`);

      // ✅ ENHANCED: Log print errors with detailed context
      await auditLogger.logLabelGeneration(
        selectedComponents.length,
        {
          location: selectedLocation,
          label_size: labelSize,
          status: 'generation_failed',
          error_message: error.message,
          selected_components: selectedComponents,
          error_type: error.name || 'UnknownError'
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = getFilteredAndSortedComponents();
  const selectedCount = selectedComponents.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            🖨️ Print Component Labels
          </h2>
          
          {/* Location Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>📍 Location:</strong> {locationName} • 
              <strong> Quantity Field:</strong> {quantityField.replace('_', ' ')} • 
              <strong> Total Components:</strong> {components.length}
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-gray-700 mb-2 font-medium">🔍 Search:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                placeholder="Barcode or description..."
                disabled={fetchingComponents}
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-gray-700 mb-2 font-medium">📊 Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                disabled={fetchingComponents}
              >
                <option value="barcode">Barcode (A-Z)</option>
                <option value="description">Description (A-Z)</option>
                <option value="quantity">Quantity (High-Low)</option>
              </select>
            </div>

            {/* Label Size */}
            <div>
              <label className="block text-gray-700 mb-2 font-medium">📏 Label Size:</label>
              <select
                value={labelSize}
                onChange={(e) => handleLabelSizeChange(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                disabled={loading}
              >
                <option value="4x1.5">4" × 1.5" (Standard)</option>
                <option value="3x1">3" × 1" (Compact)</option>
                <option value="2x1">2" × 1" (Small)</option>
              </select>
            </div>

            {/* Filter Options */}
            <div>
              <label className="block text-gray-700 mb-2 font-medium">🎯 Filter:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showOnlyWithQuantity"
                  checked={showOnlyWithQuantity}
                  onChange={(e) => handleFilterChange(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded"
                  disabled={fetchingComponents}
                />
                <label htmlFor="showOnlyWithQuantity" className="text-sm text-gray-700">
                  Only with stock
                </label>
              </div>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSelectAll}
                disabled={fetchingComponents || filteredComponents.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Select All ({filteredComponents.length})
              </button>
              <button
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Clear Selection
              </button>
              <button
                onClick={fetchComponents}
                disabled={fetchingComponents}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {fetchingComponents ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {selectedCount > 0 && (
              <div className="bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                <span className="text-yellow-800 font-medium">
                  {selectedCount} component{selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </div>

          {/* Components List */}
          <div className="mb-6">
            <label className="block text-gray-700 mb-2 font-medium">
              📋 Select Components to Print ({filteredComponents.length} found):
            </label>
            
            {fetchingComponents ? (
              <div className="border rounded-lg p-8 bg-white shadow-sm text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-700">Loading components...</p>
              </div>
            ) : filteredComponents.length === 0 ? (
              <div className="border rounded-lg p-8 bg-white shadow-sm text-center">
                <p className="text-gray-500">
                  {searchTerm ? `No components found matching "${searchTerm}"` : 'No components available'}
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border rounded-lg bg-white shadow-sm">
                <div className="sticky top-0 bg-gray-50 border-b px-4 py-2 grid grid-cols-12 gap-4 text-xs font-medium text-gray-600">
                  <div className="col-span-1">Select</div>
                  <div className="col-span-3">Barcode</div>
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Quantity</div>
                </div>
                
                {filteredComponents.map((comp) => {
                  const isSelected = selectedComponents.includes(comp.barcode);
                  const quantity = comp[quantityField] || 0;
                  
                  return (
                    <div 
                      key={comp.barcode} 
                      className={`px-4 py-3 grid grid-cols-12 gap-4 items-center border-b hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      onClick={() => handleSelectComponent(comp.barcode)}
                    >
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectComponent(comp.barcode)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="col-span-3">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {comp.barcode}
                        </span>
                      </div>
                      <div className="col-span-6">
                        <span className="text-sm text-gray-900">
                          {comp.description || 'No Description'}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className={`text-sm font-medium ${
                          quantity > 0 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {quantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Print Button */}
          <div className="text-center">
            <button
              onClick={handlePrint}
              disabled={loading || selectedCount === 0 || fetchingComponents}
              className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full max-w-md shadow-sm font-medium"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Generating Labels...
                </div>
              ) : (
                `🖨️ Print ${selectedCount} Label${selectedCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>

          {/* Status Display */}
          {status && (
            <div className={`mt-6 p-4 rounded-lg text-center ${
              status.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              status.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <p className="font-medium">{status}</p>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">💡 Tips:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Use the search box to quickly find components by barcode or description</p>
              <p>• Select multiple components to print up to 3-4 labels per page (U-Line label paper)</p>
              <p>• Filter by "Only with stock" to see components that have inventory at this location</p>
              <p>• Sort by quantity to see which components have the most stock</p>
              <p>• All printing activities are automatically logged in the audit trail</p>
            </div>
          </div>

          {/* ✅ ADDED: Audit Information */}
          <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">📊 Audit Information:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• All label printing activities are automatically logged</p>
              <p>• Component selections and searches are tracked</p>
              <p>• Configuration changes (sort, filter, label size) are recorded</p>
              <p>• View complete history in the Audit Trail section</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintSettings;