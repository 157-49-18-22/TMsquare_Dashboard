import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel file
 * @param {Array} data - The data to export
 * @param {String} filename - The name of the file (without extension)
 * @param {String} sheetName - The name of the sheet
 */
export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
  // Create a workbook
  const wb = XLSX.utils.book_new();
  
  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Save file
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Formats data for export to be more human-readable
 * @param {Array} data - The raw data
 * @param {Object} mapping - Key-value mapping of field to readable name
 * @param {Array} omitFields - Fields to omit from export
 */
export const formatDataForExport = (data, mapping = {}, omitFields = []) => {
  return data.map(item => {
    const formattedItem = {};
    
    Object.keys(item).forEach(key => {
      // Skip omitted fields
      if (omitFields.includes(key)) return;
      
      // Get field name from mapping or use original
      const fieldName = mapping[key] || key;
      
      // Format based on value type
      let value = item[key];
      
      if (value instanceof Date) {
        value = value.toLocaleString();
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects
        if (value.toDate) {
          // Firestore timestamp
          value = value.toDate().toLocaleString();
        } else {
          // Other objects - stringify
          value = JSON.stringify(value);
        }
      }
      
      formattedItem[fieldName] = value;
    });
    
    return formattedItem;
  });
};

/**
 * Creates a sample Excel template file for users to download and fill
 * @param {Array} headers - The column headers for the template
 * @param {String} filename - The name of the file (without extension)
 * @param {String} sheetName - The name of the sheet
 */
export const createExcelTemplate = (headers, filename, sheetName = 'Template') => {
  // Create a sample row with column descriptions
  const sampleRow = {};
  headers.forEach(header => {
    sampleRow[header.key] = header.description || '';
  });
  
  // Create the worksheet with headers
  const ws = XLSX.utils.json_to_sheet([sampleRow]);
  
  // Add column headers
  XLSX.utils.sheet_add_aoa(ws, [headers.map(h => h.label)], { origin: "A1" });
  
  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Save the template file
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Imports data from an Excel file
 * @param {File} file - The Excel file to import
 * @param {Object} options - Import options
 * @param {Function} options.onSuccess - Callback function when import is successful
 * @param {Function} options.onError - Callback function when import fails
 * @param {Object} options.mapping - Mapping of Excel column names to data field names
 * @param {Function} options.validateRow - Function to validate each row
 * @param {Number} options.sheetIndex - Index of the sheet to import (default: 0)
 */
export const importFromExcel = (file, options = {}) => {
  const {
    onSuccess = () => {},
    onError = () => {},
    mapping = {},
    validateRow = () => true,
    sheetIndex = 0
  } = options;

  // Create a file reader
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      // Parse the Excel file
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the worksheet
      const worksheetName = workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Convert the worksheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Extract headers and data
      if (jsonData.length < 2) {
        throw new Error('Excel file must have headers and at least one data row');
      }
      
      const headers = jsonData[0];
      const rows = jsonData.slice(1);
      
      // Process and validate the data
      const processedData = [];
      const errors = [];
      
      rows.forEach((row, rowIndex) => {
        if (row.length === 0) return; // Skip empty rows
        
        const item = {};
        let hasData = false;
        
        // Map Excel columns to data fields
        headers.forEach((header, colIndex) => {
          if (row[colIndex] !== undefined) {
            const fieldName = mapping[header] || header;
            item[fieldName] = row[colIndex];
            hasData = true;
          }
        });
        
        if (hasData) {
          // Validate the row
          const validationResult = validateRow(item, rowIndex + 2); // +2 because we're skipping header row and 0-indexing
          
          if (validationResult === true) {
            processedData.push(item);
          } else {
            errors.push({
              row: rowIndex + 2,
              message: validationResult || 'Row validation failed'
            });
          }
        }
      });
      
      // Return the processed data
      if (errors.length > 0) {
        onError(errors);
      } else {
        onSuccess(processedData);
      }
    } catch (error) {
      onError([{ message: error.message }]);
    }
  };
  
  reader.onerror = () => {
    onError([{ message: 'Failed to read file' }]);
  };
  
  // Read the file
  reader.readAsArrayBuffer(file);
};

/**
 * Parses a file and validates it before importing
 * @param {File} file - The file to parse
 * @param {Function} onComplete - Callback function when parsing is complete
 */
export const parseExcelFile = (file, onComplete) => {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get available sheet names
      const sheetNames = workbook.SheetNames;
      
      // Get data from first sheet
      const worksheetName = sheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Return basic file info and preview
      onComplete({
        success: true,
        sheetNames,
        headers: jsonData[0] || [],
        rowCount: jsonData.length - 1, // Exclude header row
        preview: jsonData.slice(1, 6) // First 5 data rows for preview
      });
    } catch (error) {
      onComplete({
        success: false,
        error: error.message
      });
    }
  };
  
  reader.onerror = () => {
    onComplete({
      success: false,
      error: 'Failed to read file'
    });
  };
  
  reader.readAsArrayBuffer(file);
}; 