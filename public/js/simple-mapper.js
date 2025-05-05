document.addEventListener('DOMContentLoaded', function() {
    const csvFileInput = document.getElementById('csvFile');
    const uploadStatus = document.getElementById('uploadStatus');
    const mappingSection = document.getElementById('mappingSection');
    const campaignTableBody = document.getElementById('campaignTableBody');
    const generateSqlBtn = document.getElementById('generateSqlBtn');
    const copySqlBtn = document.getElementById('copySqlBtn');
    const sqlOutput = document.getElementById('sqlOutput');

    let tableData = []; // To store the data currently in the table
    let originalCsvData = []; // To store the original parsed data
    let detectedCampaignHeader = null;
    let detectedSourceHeader = null;
    let detectedNetworkHeader = null; // Added for the new format
    let isNetworkFormat = false; // Flag to indicate which format is detected

    // --- CSV Parsing ---
    csvFileInput.addEventListener('change', handleFileUpload);

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            uploadStatus.textContent = 'No file selected.';
            return;
        }

        uploadStatus.textContent = `Parsing ${file.name}...`;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim().toLowerCase(), // Normalize headers
            complete: function(results) {
                console.log("Parsed CSV Data:", results.data);
                if (results.errors.length > 0) {
                    console.error("CSV Parsing Errors:", results.errors);
                    uploadStatus.textContent = `Error parsing CSV: ${results.errors[0].message}`;
                    mappingSection.style.display = 'none';
                    return;
                }

                if (!results.data.length) {
                     uploadStatus.textContent = 'CSV file is empty or has no data rows.';
                     mappingSection.style.display = 'none';
                     return;
                }

                originalCsvData = results.data; // Store original data

                // --- Flexible Header Detection ---
                // PapaParse provides headers in meta.fields when header:true
                const headers = results.meta.fields;
                if (!headers) {
                     uploadStatus.textContent = 'Error: Could not detect headers in CSV.';
                     mappingSection.style.display = 'none';
                     return;
                }
                console.log("Detected Headers:", headers); // Log detected headers

                // Define header preferences
                const campaignHeaderPreferences = ["campaign_name", "rt_campaign", "campaign"]; // "campaign_name" is preferred
                const networkHeader = "network";
                const sourceHeaderPreferences = ["source", "rt_source"];

                // Reset state
                detectedCampaignHeader = null;
                detectedSourceHeader = null;
                detectedNetworkHeader = null;
                isNetworkFormat = false;

                // 1. Detect Campaign Header
                detectedCampaignHeader = campaignHeaderPreferences.find(h => headers.includes(h));

                // 2. Detect Network or Source Header
                if (headers.includes(networkHeader)) {
                    detectedNetworkHeader = networkHeader;
                    isNetworkFormat = true;
                    console.log("Detected 'network' header. Using Network format.");
                } else {
                    detectedSourceHeader = sourceHeaderPreferences.find(h => headers.includes(h));
                    isNetworkFormat = false;
                    console.log("Did not find 'network' header. Looking for Source format.");
                }

                // 3. Validate Headers
                let errorMessage = '';
                if (!detectedCampaignHeader) {
                    errorMessage = `Error: Could not find a suitable Campaign column. Looked for: ${campaignHeaderPreferences.join(', ')}. Found: ${headers.join(', ')}`;
                } else if (!isNetworkFormat && !detectedSourceHeader) {
                    errorMessage = `Error: Could not find a suitable Network or Source column. Looked for: '${networkHeader}' or ${sourceHeaderPreferences.join(', ')}. Found: ${headers.join(', ')}`;
                } else if (isNetworkFormat && !detectedNetworkHeader) {
                    // This case should technically not happen based on the logic above, but good for robustness
                     errorMessage = `Error: Found campaign header '${detectedCampaignHeader}' but failed to confirm network header '${networkHeader}'. Found: ${headers.join(', ')}`;
                }

                if (errorMessage) {
                    uploadStatus.textContent = errorMessage;
                    mappingSection.style.display = 'none';
                    // Reset all detected headers on error
                    detectedCampaignHeader = null;
                    detectedSourceHeader = null;
                    detectedNetworkHeader = null;
                    isNetworkFormat = false;
                    return;
                }

                // Log detected headers based on format
                if (isNetworkFormat) {
                    console.log(`Using Network Format - Campaign Header: '${detectedCampaignHeader}', Network Header: '${detectedNetworkHeader}'`);
                } else {
                    console.log(`Using Source Format - Campaign Header: '${detectedCampaignHeader}', Source Header: '${detectedSourceHeader}'`);
                }


                // --- FILTERING (Adapts based on format) ---
                const originalRowCount = results.data.length;
                let filteredData;

                if (isNetworkFormat) {
                    // Network Format: Filter rows where campaign_name is empty
                    filteredData = results.data.filter(row => {
                        const campaignValue = row[detectedCampaignHeader];
                        const isCampaignEmpty = campaignValue === null || campaignValue === undefined || String(campaignValue).trim() === '';
                        return !isCampaignEmpty; // Keep if campaign is NOT empty
                    });
                    const filteredRowCount = filteredData.length;
                    if (originalRowCount !== filteredRowCount) {
                        console.log(`Filtered out ${originalRowCount - filteredRowCount} rows with empty '${detectedCampaignHeader}'.`);
                    }
                } else {
                    // Source Format: Filter rows where both source and campaign are empty (existing logic)
                    filteredData = results.data.filter(row => {
                        const sourceValue = row[detectedSourceHeader];
                        const campaignValue = row[detectedCampaignHeader];
                        const isSourceEmpty = sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === '';
                        const isCampaignEmpty = campaignValue === null || campaignValue === undefined || String(campaignValue).trim() === '';
                        return !(isSourceEmpty && isCampaignEmpty); // Keep if NOT (both are empty)
                    });
                    const filteredRowCount = filteredData.length;
                    if (originalRowCount !== filteredRowCount) {
                        console.log(`Filtered out ${originalRowCount - filteredRowCount} rows with empty '${detectedSourceHeader}' and '${detectedCampaignHeader}'.`);
                    }
                }
                // --- END FILTERING ---

                // --- SORTING (Adapts based on format) ---
                if (isNetworkFormat) {
                    // Network Format: Sort by campaign_name only
                    filteredData.sort((a, b) => {
                        const campaignA = (a[detectedCampaignHeader] || '').toLowerCase();
                        const campaignB = (b[detectedCampaignHeader] || '').toLowerCase();
                        if (campaignA < campaignB) return -1;
                        if (campaignA > campaignB) return 1;
                        return 0;
                    });
                    console.log(`Sorted CSV Data by '${detectedCampaignHeader}':`, filteredData);
                } else {
                    // Source Format: Sort by source (primary) and campaign (secondary)
                    filteredData.sort((a, b) => {
                        const sourceA = (a[detectedSourceHeader] || '').toLowerCase();
                        const sourceB = (b[detectedSourceHeader] || '').toLowerCase();
                        const campaignA = (a[detectedCampaignHeader] || '').toLowerCase();
                        const campaignB = (b[detectedCampaignHeader] || '').toLowerCase();

                        if (sourceA < sourceB) return -1;
                        if (sourceA > sourceB) return 1;
                        if (campaignA < campaignB) return -1;
                        if (campaignA > campaignB) return 1;
                        return 0;
                    });
                    console.log(`Sorted CSV Data by '${detectedSourceHeader}' then '${detectedCampaignHeader}':`, filteredData);
                }
                 // --- END SORTING ---

                // Process data using the *filtered and sorted* dataset
                processCsvData(filteredData); // Use the processed data
                const headerMessage = isNetworkFormat
                    ? `Using Network Format ('${detectedCampaignHeader}', '${detectedNetworkHeader}')`
                    : `Using Source Format ('${detectedCampaignHeader}', '${detectedSourceHeader}')`;
                uploadStatus.textContent = `Successfully loaded ${originalRowCount} rows (filtered to ${filteredData.length}) from ${file.name}. ${headerMessage}.`;
                mappingSection.style.display = 'block'; // Show table and SQL section
                sqlOutput.value = ''; // Clear previous SQL output
            },
            error: function(error) {
                console.error("PapaParse Error:", error);
                uploadStatus.textContent = `Error parsing file: ${error.message}`;
                mappingSection.style.display = 'none';
            }
        });
    }

    // --- Table Population and Handling ---
    function processCsvData(data) {
        // Map data for the table display and editing, adapting based on format
        tableData = data.map(row => {
            const campaignValue = row[detectedCampaignHeader] || '';
            let sourceValue = '';
            let networkValue = '';

            if (isNetworkFormat) {
                networkValue = row[detectedNetworkHeader] || '';
                return {
                    original_campaign_name: campaignValue,
                    original_source: null, // No original source in this format
                    original_network: networkValue, // Store original network
                    pretty_name: campaignValue, // Default pretty_name to original campaign
                    network: networkValue // Default editable network to original network
                };
            } else {
                sourceValue = row[detectedSourceHeader] || '';
                return {
                    original_campaign_name: campaignValue,
                    original_source: sourceValue, // Store original source
                    original_network: null, // No original network in this format
                    pretty_name: campaignValue, // Default pretty_name to original campaign
                    network: sourceValue // Default editable network to original source (as before)
                };
            }
        });
        renderTable();
    }

    function renderTable() {
        campaignTableBody.innerHTML = ''; // Clear existing table rows
        tableData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index; // Store index for easy updates

            tr.innerHTML = `
                <td>${escapeHtml(row.original_campaign_name)}</td>
                <td>${escapeHtml(isNetworkFormat ? row.original_network : row.original_source)}</td> {/* Display original network OR source */}
                <td contenteditable="true" data-column="pretty_name">${escapeHtml(row.pretty_name)}</td>
                <td contenteditable="true" data-column="network">${escapeHtml(row.network)}</td>
            `;
            // Add appropriate headers dynamically? For now, keep static headers in HTML
            // Or update table headers here if needed:
            // document.getElementById('originalSourceHeaderCell').textContent = isNetworkFormat ? 'Original Network' : 'Original Source';

            campaignTableBody.appendChild(tr);
        });

        // Add event listeners for editable cells after rendering
        addEditableListeners();
    }

    function addEditableListeners() {
        const editableCells = campaignTableBody.querySelectorAll('td[contenteditable="true"]');
        editableCells.forEach(cell => {
            cell.addEventListener('blur', handleCellEdit); // Save on blur (might be redundant now if paste/enter handle it)
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent adding newline
                    handleCellEdit({ target: e.target, type: 'keydown.enter' }); // Explicitly save content
                    e.target.blur();    // Then blur
                } else if (e.key === 'Escape') {
                    // Revert content before blurring
                    const originalValue = tableData[e.target.closest('tr').dataset.index][e.target.dataset.column];
                    e.target.textContent = originalValue;
                    e.target.blur();
                }
            });
            // Explicitly handle paste to ensure data model updates
            cell.addEventListener('paste', (e) => {
                // We explicitly DO NOT call e.preventDefault() here.
                console.log('Paste event allowed.');
                // Use setTimeout to allow the paste action to complete and update the DOM
                // before we read the value and update our data model.
                const targetCell = e.target;
                setTimeout(() => {
                    // Pass a custom event object indicating the trigger
                    handleCellEdit({ target: targetCell, type: 'paste.timeout' });
                }, 0);
            });
        });
    }

    function handleCellEdit(event) {
        const cell = event.target;
        const eventType = event.type || 'unknown'; // Get event type if available

        // Robustness check: Ensure cell and necessary properties exist
        if (!cell || !cell.closest || !cell.closest('tr') || !cell.closest('tr').dataset || typeof cell.closest('tr').dataset.index === 'undefined' || !cell.dataset || typeof cell.dataset.column === 'undefined') {
            console.warn(`handleCellEdit (${eventType}) triggered on invalid target:`, event.target);
            return; // Exit if the target isn't a valid cell we expect
        }
        const rowIndex = cell.closest('tr').dataset.index;
        const column = cell.dataset.column;
        const newValue = cell.textContent.trim(); // Get potentially pasted/edited value

        // Validate rowIndex
        if (typeof tableData[rowIndex] === 'undefined') {
             console.warn(`handleCellEdit (${eventType}): Invalid rowIndex ${rowIndex}. Table data length: ${tableData.length}`);
             return; // Exit if rowIndex is out of bounds
        }

        // Update the in-memory data store if the value has actually changed
        if (tableData[rowIndex][column] !== newValue) {
            tableData[rowIndex][column] = newValue;
            console.log(`Updated row ${rowIndex}, column ${column} to: ${newValue} (Trigger: ${eventType})`);
            // Optional: Add visual feedback like a temporary highlight
            cell.style.backgroundColor = '#d4edda'; // Light green flash
            setTimeout(() => { cell.style.backgroundColor = ''; }, 500);
        }
    }

    // --- SQL Generation ---
    generateSqlBtn.addEventListener('click', generateSql);

    function generateSql() {
        // Check if table data exists and required headers were detected for the identified format
        if (tableData.length === 0 || !detectedCampaignHeader || (!isNetworkFormat && !detectedSourceHeader) || (isNetworkFormat && !detectedNetworkHeader)) {
             sqlOutput.value = '-- No data loaded/processed or required headers not detected properly for the identified format.';
             return;
        }

        const tableName = 'your_target_table'; // Placeholder table name
        let sqlStatements = `-- Generated SQL for ${tableData.length} rows\n`;
        if (isNetworkFormat) {
            sqlStatements += `-- Format: Network (Using Original Campaign Header: '${detectedCampaignHeader}' for WHERE clause)\n\n`;
        } else {
            sqlStatements += `-- Format: Source (Using Original Campaign Header: '${detectedCampaignHeader}', Original Source Header: '${detectedSourceHeader}' for WHERE clause)\n\n`;
        }


        // Iterate through tableData which contains both original keys and potentially edited values
        tableData.forEach((row, index) => {
            // Basic SQL escaping for values going into SET clause (potentially edited)
            const prettyNameEscaped = (row.pretty_name || '').replace(/'/g, "''");
            const networkEscaped = (row.network || '').replace(/'/g, "''");

            // Get original values stored within the row object for the WHERE clause
            const originalCampaignValue = row.original_campaign_name || ''; // Always needed
            const originalSourceValue = row.original_source || ''; // Only relevant for source format
            // original_network is not directly used in WHERE, only original_campaign_name is used for network format

            // Escape original campaign value for WHERE clause
            const campaignValueEscaped = originalCampaignValue.replace(/'/g, "''");

            let whereClause = '';
            let canGenerate = false;
            let skipReason = '';

            if (isNetworkFormat) {
                // Network Format: WHERE clause uses only original campaign
                if (originalCampaignValue) {
                    // Use backticks (`) around header names in WHERE clause
                    whereClause = `WHERE \`${detectedCampaignHeader}\` = '${campaignValueEscaped}'`;
                    canGenerate = true;
                } else {
                    skipReason = `Missing original value for '${detectedCampaignHeader}'`;
                }
            } else {
                // Source Format: WHERE clause uses original campaign AND source
                const sourceValueEscaped = originalSourceValue.replace(/'/g, "''");
                if (originalCampaignValue && originalSourceValue) {
                     // Use backticks (`) around header names in WHERE clause
                    whereClause = `WHERE \`${detectedCampaignHeader}\` = '${campaignValueEscaped}' AND \`${detectedSourceHeader}\` = '${sourceValueEscaped}'`;
                    canGenerate = true;
                } else {
                    skipReason = `Missing original value for '${detectedCampaignHeader}' or '${detectedSourceHeader}' (Original Values: Campaign='${campaignValueEscaped}', Source='${sourceValueEscaped}')`;
                }
            }

            // Generate SQL statement if possible
            if (canGenerate) {
                 sqlStatements += `UPDATE ${tableName} SET pretty_name = '${prettyNameEscaped}', network = '${networkEscaped}' ${whereClause};\n`;
            } else {
                 // Provide context in the skip message
                 sqlStatements += `-- Skipping row index ${index}: ${skipReason}\n`;
            }
        });

        sqlOutput.value = sqlStatements;
        console.log("Generated SQL using processed table data.");
    }

    // --- Copy SQL ---
    copySqlBtn.addEventListener('click', copySqlToClipboard);

    function copySqlToClipboard() {
        if (sqlOutput.value) {
            navigator.clipboard.writeText(sqlOutput.value)
                .then(() => {
                    console.log('SQL copied to clipboard!');
                    // Optional: Provide user feedback (e.g., change button text briefly)
                    const originalText = copySqlBtn.textContent;
                    copySqlBtn.textContent = 'Copied!';
                    copySqlBtn.classList.add('btn-success');
                    copySqlBtn.classList.remove('btn-outline-secondary');
                    setTimeout(() => {
                        copySqlBtn.textContent = originalText;
                        copySqlBtn.classList.remove('btn-success');
                        copySqlBtn.classList.add('btn-outline-secondary');
                    }, 1500);
                })
                .catch(err => {
                    console.error('Failed to copy SQL: ', err);
                    alert('Failed to copy SQL to clipboard. Please copy manually.');
                });
        } else {
            console.log('No SQL to copy.');
        }
    }

    // --- Utility Functions ---
    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') {
            return '';
        }
        // Ensure it's a string before replacing
        const safeString = String(unsafe);
        return safeString
             .replace(/&/g, "&") // Use & for ampersand
             .replace(/</g, "<")  // Use < for less than
             .replace(/>/g, ">")  // Use > for greater than
             .replace(/"/g, '"') // Use " for double quote (using single quotes for the JS string)
             .replace(/'/g, "&#039;"); // Use &#039; for single quote (or ')
    }

});