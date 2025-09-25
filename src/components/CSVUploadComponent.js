// Fixed CSVUploadComponent.js - Proper barcode mapping and validation
import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';

// Enhanced header mapping with barcode support
const EXPECTED_HEADERS = {
  sku: ['sku', 'SKU', 'item_code', 'product_code', 'part_number', 'id', 'ID'],
  barcode: ['barcode', 'Barcode', 'BARCODE', 'upc', 'UPC', 'ean', 'EAN', 'gtin', 'GTIN'],
  description: ['description', 'Description', 'item_description', 'product_name', 'name', 'desc', 'DESCRIPTION'],
  expected_quantity: ['expected_quantity', 'expectedQuantity', 'quantity', 'qty', 'expected_qty', 'Quantity', 'QTY']
};

// Enhanced header mapping function
const mapHeaders = (headers) => {
  const mappedHeaders = {};
  
  Object.keys(EXPECTED_HEADERS).forEach(key => {
    const possibleHeaders = EXPECTED_HEADERS[key];
    const foundHeader = headers.find(header => 
      possibleHeaders.some(possible => 
        header.toLowerCase().trim() === possible.toLowerCase().trim()
      )
    );
    if (foundHeader) {
      mappedHeaders[key] = foundHeader;
    }
  });
  
  return mappedHeaders;
};

const CSVUploadComponent = ({ onUploadSuccess, onUploadError, existingSession = null }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Enhanced file validation
  const validateFile = (file) => {
    const errors = [];
    
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      errors.push('Please upload a CSV file');
    }
    
    if (file.size > 10 * 1024 * 1024) { // Increased to 10MB
      errors.push('File size must be less than 10MB');
    }
    
    return errors;
  };

  // Enhanced CSV data validation with barcode support
  const validateCSVData = useCallback((data, headers) => {
    const errors = [];
    const mappedHeaders = mapHeaders(headers);
    
    console.log('Available headers:', headers);
    console.log('Mapped headers:', mappedHeaders);
    
    // Check for required columns (either SKU or barcode must be present)
    if (!mappedHeaders.sku && !mappedHeaders.barcode) {
      errors.push('CSV must contain either a SKU column or Barcode column');
    }
    
    if (data.length === 0) {
      errors.push('CSV file appears to be empty');
    }
    
    // Check for duplicate identifiers
    const identifiers = new Set();
    const duplicates = [];
    data.forEach((row, index) => {
      const identifier = row[mappedHeaders.barcode] || row[mappedHeaders.sku];
      if (identifier) {
        const cleanIdentifier = identifier.toString().trim();
        if (identifiers.has(cleanIdentifier)) {
          duplicates.push(`Row ${index + 2}: ${cleanIdentifier}`);
        }
        identifiers.add(cleanIdentifier);
      }
    });
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate identifiers found: ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}`);
    }
    
    // Check for missing identifier values
    const missingIdentifiers = [];
    data.forEach((row, index) => {
      const sku = row[mappedHeaders.sku];
      const barcode = row[mappedHeaders.barcode];
      if ((!sku || sku.toString().trim() === '') && (!barcode || barcode.toString().trim() === '')) {
        missingIdentifiers.push(index + 2);
      }
    });
    
    if (missingIdentifiers.length > 0) {
      errors.push(`Missing identifier values in rows: ${missingIdentifiers.slice(0, 10).join(', ')}${missingIdentifiers.length > 10 ? '...' : ''}`);
    }
    
    return { errors, mappedHeaders, validRows: data.length - missingIdentifiers.length };
  }, []);

  // Enhanced CSV processing with proper barcode handling
  const processCSVFile = useCallback((file) => {
    setIsProcessing(true);
    setUploadStatus('Processing CSV file...');
    setValidationErrors([]);
    
    Papa.parse(file, {
      header: true,
      dynamicTyping: false, // Keep as strings to preserve leading zeros in barcodes
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      complete: (results) => {
        try {
          const { data, meta } = results;
          
          if (meta.errors && meta.errors.length > 0) {
            const criticalErrors = meta.errors.filter(error => error.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              throw new Error('Unable to parse CSV file. Please check the file format.');
            }
          }
          
          console.log('Parsed CSV data:', data.slice(0, 3));
          console.log('CSV headers:', meta.fields);
          
          const { errors, mappedHeaders, validRows } = validateCSVData(data, meta.fields);
          
          if (errors.length > 0) {
            setValidationErrors(errors);
            setIsProcessing(false);
            setUploadStatus('');
            return;
          }
          
          // Transform data with proper barcode support
          const transformedData = data
            .filter(row => {
              const sku = row[mappedHeaders.sku];
              const barcode = row[mappedHeaders.barcode];
              return (sku && sku.toString().trim() !== '') || (barcode && barcode.toString().trim() !== '');
            })
            .map((row, index) => {
              // Use barcode as primary identifier, fall back to SKU
              const primaryIdentifier = row[mappedHeaders.barcode]?.toString().trim() || 
                                       row[mappedHeaders.sku]?.toString().trim() || 
                                       `unknown_${index}`;
              
              const secondaryIdentifier = row[mappedHeaders.sku]?.toString().trim() || 
                                          row[mappedHeaders.barcode]?.toString().trim() || 
                                          primaryIdentifier;
              
              return {
                sku: primaryIdentifier, // This will be used for searching/matching
                barcode: primaryIdentifier, // Keep same for consistency
                alternateId: secondaryIdentifier !== primaryIdentifier ? secondaryIdentifier : null,
                description: row[mappedHeaders.description]?.toString().trim() || '',
                expected_quantity: parseInt(row[mappedHeaders.expected_quantity]) || 0,
                originalRow: index + 2 // For error reporting
              };
            });
          
          console.log('Transformed data sample:', transformedData.slice(0, 3));
          
          // Create preview
          const previewInfo = {
            filename: file.name,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            totalRows: data.length,
            validRows: transformedData.length,
            skippedRows: data.length - transformedData.length,
            headers: mappedHeaders,
            sampleData: transformedData.slice(0, 5),
            uploadTime: new Date().toISOString(),
            hasBarcode: !!mappedHeaders.barcode,
            hasSku: !!mappedHeaders.sku
          };
          
          setPreviewData({ transformedData, previewInfo });
          setShowPreview(true);
          setUploadStatus(`Preview ready: ${validRows} items to count`);
          setIsProcessing(false);
          
        } catch (error) {
          console.error('CSV processing error:', error);
          setValidationErrors([error.message || 'Error processing CSV file']);
          setUploadStatus('');
          setIsProcessing(false);
        }
      },
      error: (error) => {
        console.error('Papa Parse error:', error);
        setValidationErrors(['Error parsing CSV file. Please check the file format.']);
        setUploadStatus('');
        setIsProcessing(false);
      }
    });
  }, [validateCSVData]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const errors = validateFile(file);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
      
      processCSVFile(file);
    }
  }, [processCSVFile]);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const errors = validateFile(file);
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }
      
      processCSVFile(file);
    }
  }, [processCSVFile]);

  const handleConfirmUpload = () => {
    if (!previewData) return;
    
    try {
      onUploadSuccess(previewData.previewInfo.filename, previewData.transformedData);
      setPreviewData(null);
      setShowPreview(false);
      setUploadStatus('Upload successful!');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Upload confirmation error:', error);
      onUploadError(error.message || 'Error confirming upload');
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setShowPreview(false);
    setUploadStatus('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasExistingSession = existingSession && existingSession.skus && existingSession.skus.length > 0;

  return (
    <div className="space-y-6">
      {/* Existing Session Warning */}
      {hasExistingSession && (
        <div 
          className="rounded-lg p-4 border"
          style={{ 
            backgroundColor: '#FEF3C7', 
            borderColor: '#F59E0B',
            color: '#B45309'
          }}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium">Active Session Found</div>
              <div className="text-sm">
                You have {existingSession.countProgress.counted} of {existingSession.countProgress.total} items counted. 
                Uploading a new CSV will replace your current session.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Status */}
      {uploadStatus && (
        <div 
          className="rounded-lg p-4 border"
          style={{ 
            backgroundColor: '#DCFCE7', 
            borderColor: '#86EFAC',
            color: '#059669'
          }}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{uploadStatus}</span>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div 
          className="rounded-lg p-4 border"
          style={{ 
            backgroundColor: '#FEE2E2', 
            borderColor: '#F87171',
            color: '#B91C1C'
          }}
        >
          <div className="font-medium mb-2">Upload Errors:</div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File Upload Area */}
      {!showPreview && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
            isDragging 
              ? 'border-emerald-400 bg-emerald-50' 
              : 'border-gray-300 hover:border-emerald-300 hover:bg-gray-50'
          }`}
          style={{ 
            backgroundColor: isDragging ? '#DCFCE7' : 'white',
            borderColor: isDragging ? '#86EFAC' : '#D1D5DB'
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="space-y-4">
            <div 
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#86EFAC' }}
            >
              <svg 
                className="w-8 h-8" 
                style={{ color: '#00001C' }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {isProcessing ? 'Processing CSV...' : 'Upload Inventory CSV'}
              </h3>
              <p className="text-gray-600 mt-2">
                Drag and drop your CSV file here, or click to browse
              </p>
            </div>
            
            <div className="text-sm text-gray-500 space-y-1">
              <div>• Accepted format: CSV files only</div>
              <div>• Required columns: SKU OR Barcode (at least one)</div>
              <div>• Optional columns: Description, Expected Quantity</div>
              <div>• Supports UPC, EAN, and other barcode formats</div>
              <div>• Maximum file size: 10MB</div>
            </div>
            
            {isProcessing && (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-emerald-600">Processing...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            style={{ backgroundColor: 'white' }}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                CSV Upload Preview - Enhanced Barcode Support
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                Review your data before starting the count session
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* File Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-sm text-gray-600">Filename</div>
                  <div className="font-medium text-gray-900">{previewData.previewInfo.filename}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-sm text-gray-600">File Size</div>
                  <div className="font-medium text-gray-900">{previewData.previewInfo.fileSize}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-sm text-gray-600">Total Items</div>
                  <div className="font-medium text-gray-900">{previewData.previewInfo.validRows}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50">
                  <div className="text-sm text-gray-600">Skipped Rows</div>
                  <div className="font-medium text-gray-900">{previewData.previewInfo.skippedRows}</div>
                </div>
              </div>

              {/* Enhanced Column Mapping */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Column Mapping</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  <div className="text-sm font-medium text-green-800">Barcode Support Active</div>
                  <div className="text-xs text-green-600 mt-1">
                    {previewData.previewInfo.hasBarcode ? 'Barcode column detected and mapped' : 'Using SKU column as identifier'}
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(previewData.previewInfo.headers).map(([key, value]) => (
                    <div key={key} className="flex items-center text-sm">
                      <span className="font-medium text-gray-700 w-32 capitalize">{key.replace('_', ' ')}:</span>
                      <span className="text-gray-600">"{value}"</span>
                      {key === 'barcode' && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          Primary ID
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Data Preview */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Sample Data (First 5 Rows)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200">Identifier</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200">Description</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200">Expected Qty</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.previewInfo.sampleData.map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b border-gray-200 font-mono">
                            {row.sku}
                            {row.alternateId && (
                              <div className="text-xs text-gray-500 mt-1">Alt: {row.alternateId}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 border-b border-gray-200">{row.description || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b border-gray-200">{row.expected_quantity}</td>
                          <td className="px-4 py-2 text-sm border-b border-gray-200">
                            {previewData.previewInfo.hasBarcode ? (
                              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                Barcode
                              </span>
                            ) : (
                              <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                SKU
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={handleCancelPreview}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: '#86EFAC', 
                  color: '#00001C'
                }}
              >
                Start Count Session ({previewData.previewInfo.validRows} items)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVUploadComponent;