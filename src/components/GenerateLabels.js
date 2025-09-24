import React, { useState } from 'react';
import { getLocationByCode, quantityFieldMap } from '../config/theme';
import { 
  componentsAPI,
  labelsAPI,
  utils
} from '../utils/api';
import auditLogger from '../utils/auditLogger'; // ✅ Added audit logger import

const GenerateLabels = ({ selectedLocation, user }) => {
  const [manualInput, setManualInput] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Get location info
  const locationInfo = getLocationByCode(selectedLocation);
  const locationName = locationInfo?.name || selectedLocation;
  const quantityField = quantityFieldMap[selectedLocation] || 'primary_quantity';

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const parseManualInput = (input) => {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    const components = [];

    lines.forEach((line, index) => {
      let barcode, description, quantity;

      // Handle format: (ID,Description,Quantity) or (ID,Quantity)
      if (line.startsWith('(') && line.endsWith(')')) {
        const cleanedLine = line.slice(1, -1).trim();
        const parts = cleanedLine.split(',').map(item => item.trim());
        if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
          [barcode, description, quantity] = parts;
          components.push({
            barcode,
            description,
            [quantityField]: parseInt(quantity) || 0,
          });
        } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
          [barcode, quantity] = parts;
          components.push({
            barcode,
            description: '',
            [quantityField]: parseInt(quantity) || 0,
          });
        } else {
          setStatus(`Error: Invalid format at line ${index + 1}. Expected '(ID,Description,Quantity)' or '(ID,Quantity)' with valid ID and numeric quantity.`);
        }
      }
      // Handle format: ID,Description,Quantity or ID,Quantity
      else {
        const parts = line.split(',').map(item => item.trim());
        if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
          [barcode, description, quantity] = parts;
          components.push({
            barcode,
            description,
            [quantityField]: parseInt(quantity) || 0,
          });
        } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
          [barcode, quantity] = parts;
          components.push({
            barcode,
            description: '',
            [quantityField]: parseInt(quantity) || 0,
          });
        } else {
          setStatus(`Error: Invalid format at line ${index + 1}. Expected 'ID,Description,Quantity' or 'ID,Quantity' with valid ID and numeric quantity.`);
        }
      }
    });

    console.log('Parsed components:', components);
    return components;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');
    setLoading(true);

    if (!selectedLocation) {
      setStatus('Error: No location selected. Please select a location before generating labels.');
      setLoading(false);
      return;
    }

    if (!utils.isAuthenticated()) {
      setStatus('Error: Not authenticated. Please log in again.');
      setLoading(false);
      return;
    }

    let components = [];
    
    try {
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target.result;
          const lines = text.split('\n').map(line => line.trim()).filter(line => line);
          components = lines.map((line, index) => {
            const parts = line.split(',').map(item => item.trim());
            if (parts.length === 3 && parts[0] && !isNaN(parts[2])) {
              const [barcode, description, quantity] = parts;
              return {
                barcode,
                description,
                [quantityField]: parseInt(quantity) || 0,
              };
            } else if (parts.length === 2 && parts[0] && !isNaN(parts[1])) {
              const [barcode, quantity] = parts;
              return {
                barcode,
                description: '',
                [quantityField]: parseInt(quantity) || 0,
              };
            } else {
              setStatus(`Error: Invalid CSV format at line ${index + 1}. Expected "ID,Description,Quantity" or "ID,Quantity" with valid ID and numeric quantity.`);
              return null;
            }
          }).filter(comp => comp !== null);
          
          console.log('Parsed components from file:', components);
          if (components.length > 0) {
            processComponents(components);
          } else {
            setStatus('No valid components found in CSV.');
            setLoading(false);
          }
        };
        reader.readAsText(file);
      } else if (manualInput) {
        components = parseManualInput(manualInput);
        if (components.length === 0) {
          setStatus('No valid components found. Please use format "ID,Description,Quantity", "ID,Quantity", "(ID,Description,Quantity)", or "(ID,Quantity)" with valid ID and numeric quantity.');
          setLoading(false);
          return;
        }
        await processComponents(components);
      } else {
        setStatus('Please provide input data (manual entry or CSV file).');
        setLoading(false);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setLoading(false);
      console.error('Error in handleSubmit:', error);

      // ✅ ADDED: Log submission error
      await auditLogger.logLabelGeneration(
        0, 
        {
          error: error.message,
          input_type: file ? 'csv_file' : 'manual_input',
          location: selectedLocation,
          status: 'submission_error'
        }
      );
    }
  };

  const processComponents = async (components) => {
    try {
      // ✅ ADDED: Log label generation start
      await auditLogger.logLabelGeneration(
        components.length,
        {
          input_type: file ? 'csv_file' : 'manual_input',
          location: selectedLocation,
          status: 'processing_started',
          component_count: components.length
        }
      );

      // ✅ Use backend API to get existing components
      const existingComponents = await componentsAPI.getComponents();
      
      // Prepare components with total_quantity calculation
      const updatedComponents = await Promise.all(
        components.map(async (comp) => {
          const existing = existingComponents.find(e => e.barcode === comp.barcode);
          const newQuantity = comp[quantityField] || 0;

          if (existing) {
            // If barcode exists, calculate new total_quantity
            const currentQuantities = {
              primary_quantity: existing.primary_quantity || 0,
              secondary_quantity: existing.secondary_quantity || 0,
              fulfillment_quantity: existing.fulfillment_quantity || 0,
              distribution_quantity: existing.distribution_quantity || 0,
              quarantine_quantity: existing.quarantine_quantity || 0,
            };
            
            // Update the specific location quantity
            currentQuantities[quantityField] = newQuantity;
            
            const totalQuantity = Object.values(currentQuantities).reduce((sum, qty) => sum + qty, 0);
            
            return {
              ...comp,
              ...currentQuantities,
              total_quantity: totalQuantity,
              id: existing.id, // Include existing ID for updates
            };
          } else {
            // New barcode, total_quantity is just the entered quantity
            const newComponent = {
              ...comp,
              primary_quantity: selectedLocation === 'PRIMARY' ? newQuantity : 0,
              secondary_quantity: selectedLocation === 'SECONDARY' ? newQuantity : 0,
              fulfillment_quantity: selectedLocation === 'FULFILLMENT' ? newQuantity : 0,
              distribution_quantity: selectedLocation === 'DISTRIBUTION' ? newQuantity : 0,
              quarantine_quantity: 0,
              total_quantity: newQuantity,
            };
            
            return newComponent;
          }
        })
      );

      // ✅ Sync with backend API instead of direct Supabase
      const importResult = await componentsAPI.importComponents(updatedComponents);
      console.log('Components synced via backend API:', importResult);

      // ✅ ADDED: Log bulk import
      await auditLogger.logBulkImport(
        updatedComponents.length,
        selectedLocation,
        'label_generation_import',
        {
          new_components: updatedComponents.filter(comp => !comp.id).length,
          updated_components: updatedComponents.filter(comp => comp.id).length,
          total_quantity_added: updatedComponents.reduce((sum, comp) => sum + (comp[quantityField] || 0), 0)
        }
      );

      // ✅ Generate labels using backend API
      const labelComponents = updatedComponents.map(comp => ({
        id: comp.barcode,
        barcode: comp.barcode,
        description: comp.description,
        quantity: comp[quantityField],
      }));

      const labelBlob = await labelsAPI.generateLabels(labelComponents, {
        includeId: true,
        labelSize: { width: 4, height: 1.5 }
      });

      // Download the generated PDF
      const url = window.URL.createObjectURL(labelBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `labels_${selectedLocation}_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // ✅ ADDED: Log successful label generation
      await auditLogger.logLabelGeneration(
        labelComponents.length,
        {
          input_type: file ? 'csv_file' : 'manual_input',
          location: selectedLocation,
          status: 'completed_successfully',
          pdf_filename: `labels_${selectedLocation}_${new Date().toISOString().slice(0, 10)}.pdf`,
          label_size: { width: 4, height: 1.5 },
          include_id: true,
          total_components_processed: updatedComponents.length
        }
      );

      setStatus(`✅ Success! Generated ${labelComponents.length} labels and synced to ${locationName}.`);
      
      // Clear form after success
      setManualInput('');
      setFile(null);
      
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Error in processComponents:', error);

      // ✅ ADDED: Log processing error
      await auditLogger.logLabelGeneration(
        components.length,
        {
          input_type: file ? 'csv_file' : 'manual_input',
          location: selectedLocation,
          status: 'processing_error',
          error: error.message,
          component_count: components.length
        }
      );

    } finally {
      setLoading(false);
    }
  };

  // Show loading if user data isn't available yet
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="spinner mb-4"></div>
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
            🏷️ Generate Barcode Labels for New Products
          </h2>
          
          {/* ✅ ADDED: Debug info for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-100 p-3 rounded mb-4 text-xs">
              <strong>Debug Info:</strong><br/>
              User: {user?.email}<br/>
              Location: {selectedLocation} ({locationName})<br/>
              Quantity Field: {quantityField}<br/>
              API Available: {utils.isAuthenticated() ? 'Yes' : 'No'}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-blue-800 mb-2 font-medium">
              📍 Location: {locationName}
            </label>
            <p className="text-sm text-blue-700">
              Quantity will be added to <strong>{quantityField.replace('_', ' ')}</strong> and recalculated in total_quantity.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                ✏️ Manual Entry (ID,Description,Quantity or ID,Quantity - one per line):
              </label>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                rows="5"
                placeholder="e.g., TEST123,Widget,10 or 123,10"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                📁 Or Upload CSV File (ID,Description,Quantity or ID,Quantity):
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div className="text-center">
              <button
                type="submit"
                disabled={loading || (!manualInput && !file)}
                className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-full max-w-md shadow-sm font-medium"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  '🏷️ Generate Labels & Sync'
                )}
              </button>
            </div>
          </form>

          {status && (
            <div className={`mt-6 p-4 rounded-lg text-center ${
              status.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              status.includes('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <p className="font-medium">{status}</p>
            </div>
          )}

          {/* ✅ ADDED: Help section */}
          <div className="mt-8 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">📝 Format Examples:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>With Description:</strong> PROD123,Widget Name,25</p>
              <p><strong>ID Only:</strong> PROD456,50</p>
              <p><strong>With Parentheses:</strong> (PROD789,Special Item,10)</p>
            </div>

            {/* ✅ ADDED: Recent activity indicator */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2">📊 Audit Information:</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• All label generation activities are automatically logged</p>
                <p>• Component imports and updates are tracked</p>
                <p>• View complete history in the Audit Trail section</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateLabels;