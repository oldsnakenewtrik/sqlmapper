document.addEventListener('DOMContentLoaded', function() {
    const csvFileInput = document.getElementById('csvFile');
    const uploadStatus = document.getElementById('uploadStatus');
    const mappingSection = document.getElementById('mappingSection');
    const campaignTableBody = document.getElementById('campaignTableBody');
    const generateSqlBtn = document.getElementById('generateSqlBtn');
    const copySqlBtn = document.getElementById('copySqlBtn');
    const sqlOutput = document.getElementById('sqlOutput');

    let tableData = []; // To store the data currently in the table

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

                // Check for required headers
                const headers = Object.keys(results.data[0]);
                const requiredHeaders = ['campaign name', 'source'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    uploadStatus.textContent = `Error: Missing required columns in CSV: ${missingHeaders.join(', ')}. Found: ${headers.join(', ')}`;
                    mappingSection.style.display = 'none';
                    return;
                }

                processCsvData(results.data);
                uploadStatus.textContent = `Successfully loaded ${results.data.length} rows from ${file.name}.`;
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
        tableData = data.map(row => ({
            campaign_name: row['campaign name'] || '',
            source: row['source'] || '',
            pretty_name: row['campaign name'] || '', // Default pretty name to campaign name
            network: row['source'] || '' // Default network to source
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
            cell.addEventListener('blur', handleCellEdit); // Save on blur
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent adding newline
                    e.target.blur();    // Trigger save
                } else if (e.key === 'Escape') {
                    // Revert content before blurring
                    const originalValue = tableData[e.target.closest('tr').dataset.index][e.target.dataset.column];
                    e.target.textContent = originalValue;
                    e.target.blur();
                }
            });
        });
    }

    function handleCellEdit(event) {
        const cell = event.target;
        const rowIndex = cell.closest('tr').dataset.index;
        const column = cell.dataset.column;
        const newValue = cell.textContent.trim(); // Get edited value

        // Update the in-memory data store
        if (tableData[rowIndex] && tableData[rowIndex][column] !== newValue) {
            tableData[rowIndex][column] = newValue;
            console.log(`Updated row ${rowIndex}, column ${column} to: ${newValue}`);
            // Optional: Add visual feedback like a temporary highlight
            cell.style.backgroundColor = '#d4edda'; // Light green flash
            setTimeout(() => { cell.style.backgroundColor = ''; }, 500);
        }
    }

    // --- SQL Generation ---
    generateSqlBtn.addEventListener('click', generateSql);

    function generateSql() {
        if (tableData.length === 0) {
            sqlOutput.value = '-- No data loaded to generate SQL.';
            return;
        }

        const tableName = 'your_target_table'; // Placeholder table name
        let sqlStatements = `-- Generated SQL for ${tableData.length} rows\n`;

        tableData.forEach(row => {
            // Basic SQL escaping (replace single quote with two single quotes)
            const prettyNameEscaped = (row.pretty_name || '').replace(/'/g, "''");
            const networkEscaped = (row.network || '').replace(/'/g, "''");
            const campaignNameEscaped = (row.campaign_name || '').replace(/'/g, "''");
            const sourceEscaped = (row.source || '').replace(/'/g, "''");

            // Only generate SQL if essential original identifiers are present
            if (campaignNameEscaped && sourceEscaped) {
                 sqlStatements += `UPDATE ${tableName} SET pretty_name = '${prettyNameEscaped}', network = '${networkEscaped}' WHERE campaign_name = '${campaignNameEscaped}' AND source = '${sourceEscaped}';\n`;
            } else {
                 sqlStatements += `-- Skipping row: Missing campaign_name or source (Original: Campaign='${campaignNameEscaped}', Source='${sourceEscaped}')\n`;
            }
        });

        sqlOutput.value = sqlStatements;
        console.log("Generated SQL.");
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
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

});