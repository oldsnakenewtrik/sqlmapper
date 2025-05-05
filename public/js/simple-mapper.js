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

                const campaignHeaderPreferences = ["campaign name", "rt_campaign", "campaign"];
                const sourceHeaderPreferences = ["source", "rt_source"];

                // Find the first matching header based on preference order
                detectedCampaignHeader = campaignHeaderPreferences.find(h => headers.includes(h));
                detectedSourceHeader = sourceHeaderPreferences.find(h => headers.includes(h));

                // Validate if headers were found
                if (!detectedCampaignHeader) {
                    uploadStatus.textContent = `Error: Could not find a suitable Campaign Name column. Looked for: ${campaignHeaderPreferences.join(', ')}. Found: ${headers.join(', ')}`;
                    mappingSection.style.display = 'none';
                    detectedCampaignHeader = null; // Reset just in case
                    detectedSourceHeader = null;
                    return;
                }
                if (!detectedSourceHeader) {
                    uploadStatus.textContent = `Error: Could not find a suitable Source column. Looked for: ${sourceHeaderPreferences.join(', ')}. Found: ${headers.join(', ')}`;
                    mappingSection.style.display = 'none';
                    detectedCampaignHeader = null; // Reset just in case
                    detectedSourceHeader = null;
                    return;
                }

                console.log(`Using Campaign Header: '${detectedCampaignHeader}', Source Header: '${detectedSourceHeader}'`);

                // --- FILTERING ---
                // Filter out rows where both source and campaign are effectively empty
                const originalRowCount = results.data.length;
                results.data = results.data.filter(row => {
                    const sourceValue = row[detectedSourceHeader];
                    const campaignValue = row[detectedCampaignHeader];
                    // Keep row if EITHER source OR campaign has a non-empty value (treat null/undefined/empty string as empty)
                    const isSourceEmpty = sourceValue === null || sourceValue === undefined || String(sourceValue).trim() === '';
                    const isCampaignEmpty = campaignValue === null || campaignValue === undefined || String(campaignValue).trim() === '';
                    return !(isSourceEmpty && isCampaignEmpty); // Keep if NOT (both are empty)
                });
                const filteredRowCount = results.data.length;
                if (originalRowCount !== filteredRowCount) {
                    console.log(`Filtered out ${originalRowCount - filteredRowCount} rows with empty source and campaign.`);
                }
                // --- END FILTERING ---
 
                // --- SORTING ---
                // Sort the *filtered* data by source (primary) and campaign (secondary), case-insensitive
                results.data.sort((a, b) => {
                    const sourceA = (a[detectedSourceHeader] || '').toLowerCase();
                    const sourceB = (b[detectedSourceHeader] || '').toLowerCase();
                    const campaignA = (a[detectedCampaignHeader] || '').toLowerCase();
                    const campaignB = (b[detectedCampaignHeader] || '').toLowerCase();

                    if (sourceA < sourceB) return -1;
                    if (sourceA > sourceB) return 1;

                    // If sources are equal, sort by campaign
                    if (campaignA < campaignB) return -1;
                    if (campaignA > campaignB) return 1;

                    return 0; // If both are equal
                });
                console.log("Sorted CSV Data:", results.data); // Log sorted data
                // --- END SORTING ---

                // Process data using the *sorted* dataset
                processCsvData(results.data); // Use the sorted data now
                uploadStatus.textContent = `Successfully loaded ${originalCsvData.length} rows from ${file.name}. Using '${detectedCampaignHeader}' and '${detectedSourceHeader}'.`;
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
        // Map data for the table display and editing using detected headers
        tableData = data.map(row => ({
            // Use detected headers for display/editing columns
            campaign_name: row[detectedCampaignHeader] || '',
            source: row[detectedSourceHeader] || '',
            // Keep defaults based on detected headers for initial pretty_name/network
            pretty_name: row[detectedCampaignHeader] || '',
            network: row[detectedSourceHeader] || ''
            // Original row data is kept in originalCsvData for SQL generation
        }));
        renderTable();
    }

    function renderTable() {
        campaignTableBody.innerHTML = ''; // Clear existing table rows
        tableData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.dataset.index = index; // Store index for easy updates

            tr.innerHTML = `
                <td>${escapeHtml(row.campaign_name)}</td>
                <td>${escapeHtml(row.source)}</td>
                <td contenteditable="true" data-column="pretty_name">${escapeHtml(row.pretty_name)}</td>
                <td contenteditable="true" data-column="network">${escapeHtml(row.network)}</td>
            `;
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
        // Check if original data exists and headers were detected
        if (originalCsvData.length === 0 || !detectedCampaignHeader || !detectedSourceHeader) {
            sqlOutput.value = '-- No data loaded or required headers not detected properly.';
            return;
        }

        const tableName = 'your_target_table'; // Placeholder table name
        let sqlStatements = `-- Generated SQL for ${originalCsvData.length} rows\n`;
        sqlStatements += `-- Using Campaign Header: '${detectedCampaignHeader}', Source Header: '${detectedSourceHeader}'\n\n`;

        // Iterate through original data for WHERE clause, use tableData for SET clause
        originalCsvData.forEach((originalRow, index) => {
            const editedRow = tableData[index]; // Get corresponding potentially edited row from tableData

            // Basic SQL escaping for values going into SET clause
            const prettyNameEscaped = (editedRow.pretty_name || '').replace(/'/g, "''");
            const networkEscaped = (editedRow.network || '').replace(/'/g, "''");

            // Get original values using detected headers for the WHERE clause
            const originalCampaignValue = originalRow[detectedCampaignHeader] || '';
            const originalSourceValue = originalRow[detectedSourceHeader] || '';

            // Escape original values for WHERE clause
            const campaignValueEscaped = originalCampaignValue.replace(/'/g, "''");
            const sourceValueEscaped = originalSourceValue.replace(/'/g, "''");

            // Only generate SQL if essential original identifiers are present
            if (campaignValueEscaped && sourceValueEscaped) {
                 // Use backticks (`) around header names in WHERE clause to handle spaces/special chars
                 sqlStatements += `UPDATE ${tableName} SET pretty_name = '${prettyNameEscaped}', network = '${networkEscaped}' WHERE \`${detectedCampaignHeader}\` = '${campaignValueEscaped}' AND \`${detectedSourceHeader}\` = '${sourceValueEscaped}';\n`;
            } else {
                 // Provide more context in the skip message
                 sqlStatements += `-- Skipping row index ${index}: Missing original value for '${detectedCampaignHeader}' or '${detectedSourceHeader}' (Original Values: Campaign='${campaignValueEscaped}', Source='${sourceValueEscaped}')\n`;
            }
        });

        sqlOutput.value = sqlStatements;
        console.log("Generated SQL using detected headers.");
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
             .replace(/&/g, "&") // Correctly escape ampersands first
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "&amp;quot;") // Correctly escape double quotes
             .replace(/'/g, "&#039;"); // Use HTML entity for single quote
    }

});