document.addEventListener('DOMContentLoaded', () => {
    const numLibsSelect = document.getElementById('numLibs');
    const poolTable = document.getElementById('poolTable');
    const downloadBtn = document.getElementById('downloadBtn');
    const concTable = document.getElementById('concTable');
    const wtaReadsDiv = document.getElementById('wtaReads');
    const finalMixTable = document.getElementById('finalMixTable');

    let warningDiv = document.createElement('div');
    warningDiv.style.color = 'red';
    warningDiv.style.marginTop = '0.5em';
    concTable.parentNode.insertBefore(warningDiv, concTable.nextSibling);

    function createTable(num, prevData = []) {
        let html = `<tr>
            <th>Library</th>
            <th>Library ID</th>
            <th>Plate</th>
            <th>Qubit Conc. (ng/µl)</th>
            <th>Fragment Length (bp)</th>
            <th>Pool Area</th>
            <th>Conc. (nM)</th>
            <th>Ratio</th>
        </tr>`;
        for (let i = 0; i < num; i++) {
            const prev = prevData[i] || {};
            html += `<tr>
                <td>Library ${i + 1}</td>
                <td><input type="text" id="library_id_${i}" value="${prev.library_id || ''}"></td>
                <td><input type="text" id="plate_${i}" value="${prev.plate || ''}"></td>
                <td><input type="number" step="any" id="qubit_${i}" class="input-field" value="${prev.qubit || ''}"></td>
                <td><input type="number" step="any" id="fraglen_${i}" value="${prev.fraglen || 162}"></td>
                <td><input type="number" step="any" id="area_${i}" class="input-field" value="${prev.area || ''}"></td>
                <td id="mol_${i}">0.00</td>
                <td id="ratio_${i}">0.00</td>
            </tr>`;
        }
        poolTable.innerHTML = html;
    }

    function getCurrentInputData(num) {
        let data = [];
        for (let i = 0; i < num; i++) {
            data.push({
                library_id: document.getElementById(`library_id_${i}`)?.value || '',
                plate: document.getElementById(`plate_${i}`)?.value || '',
                qubit: document.getElementById(`qubit_${i}`)?.value || '',
                fraglen: document.getElementById(`fraglen_${i}`)?.value || 162,
                area: document.getElementById(`area_${i}`)?.value || ''
            });
        }
        return data;
    }

    function updateCalc() {
        const num = parseInt(numLibsSelect.value);
        let mols = [], areas = [], ratios = [];
        let totalArea = 0;

        for (let i = 0; i < num; i++) {
            const qubit = parseFloat(document.getElementById(`qubit_${i}`).value);
            const fraglen = parseFloat(document.getElementById(`fraglen_${i}`).value);
            const area = parseFloat(document.getElementById(`area_${i}`).value);
            mols[i] = (!isNaN(qubit) && !isNaN(fraglen) && fraglen > 0) ? (qubit * 1000000) / (fraglen * 660) : 0;
            areas[i] = isNaN(area) ? 0 : area;
            totalArea += areas[i];
            document.getElementById(`mol_${i}`).innerText = mols[i].toFixed(2);
        }

        for (let i = 0; i < num; i++) {
            const ratio = totalArea > 0 ? areas[i] / totalArea : 0;
            ratios[i] = ratio;
            document.getElementById(`ratio_${i}`).innerText = ratio.toFixed(3);
        }

        wtaReadsDiv.textContent = `Estimated WTA reads: ${(100 * totalArea).toLocaleString()} reads`;
        renderConcTable(num, mols, areas, ratios, totalArea);
    }

    function renderConcTable(num, mols, areas, ratios, totalArea) {
        const targetVol = parseFloat(document.getElementById('targetVol')?.value) || 20.0;
        const targetConc = parseFloat(document.getElementById('targetConc')?.value) || 2.0;

        let dilutionConcs = [], volsToPool = [], sumVols = 0;
        let table = `<tr><th>Library ID</th><th>Quantification<br>(nM)</th><th>Dilution factor</th><th>Dilution conc.<br>(nM)</th><th>Vol. to pool<br>(µL)</th><th>Proportion</th><th>Final conc.<br>(nM)</th></tr>`;

        for (let i = 0; i < num; i++) {
            let dilfacId = `dilfac2_${i}`;
            let prevDilfac = document.getElementById(dilfacId)?.value || 4;
            table += `<tr><td>${document.getElementById(`library_id_${i}`).value}</td><td>${mols[i].toFixed(2)}</td>` +
                `<td><input type="number" step="any" id="${dilfacId}" class="input-field2" value="${prevDilfac}" min="1"></td>`;
            const dilfac = parseFloat(prevDilfac) || 4;
            const dilConc = mols[i] / dilfac;
            dilutionConcs[i] = dilConc;
            const volToPool = dilConc > 0 ? (targetVol * targetConc * ratios[i]) / dilConc : 0;
            volsToPool[i] = volToPool;
            sumVols += volToPool;
            const prop = ratios[i];
            const finalConc = targetConc * prop;
            table += `<td>${dilutionConcs[i].toFixed(2)}</td><td>${volToPool.toFixed(2)}</td><td>${prop.toFixed(3)}</td><td>${finalConc.toFixed(2)}</td></tr>`;
        }

        const ebVol = targetVol - sumVols;
        table += `<tr><td colspan="5">EB</td><td>${ebVol.toFixed(2)}</td><td colspan="2"></td></tr>`;
        concTable.innerHTML = table;

        warningDiv.textContent = (sumVols > targetVol)
            ? `⚠️ Warning: Total pooled volumes (${sumVols.toFixed(2)} µL) exceed target volume (${targetVol.toFixed(2)} µL). Adjust dilution factors or target volume.`
            : '';

        for (let i = 0; i < num; i++) {
            document.getElementById(`dilfac2_${i}`).addEventListener('input', updateCalc);
        }

        updateFinalMixTable(targetConc);
    }

    function updateFinalMixTable(finalLibConc) {
        const finalTargetConcP = parseFloat(document.getElementById('finalTargetConc')?.value) || 650;
        const finalTargetVol = parseFloat(document.getElementById('finalTargetVol')?.value) || 20;
        const phiXpercent = parseFloat(document.getElementById('phiXpercent')?.value) || 5;

        const finalTargetConc = finalTargetConcP / 1000; // convert to nM
        const phiXvol = finalTargetVol * (phiXpercent / 100);
        const libVol = (finalTargetConc * finalTargetVol) / finalLibConc;
        const ebVol = finalTargetVol - libVol - phiXvol;

        const safeLibVol = Math.max(0, libVol);
        const safeEbVol = Math.max(0, ebVol);

        finalMixTable.innerHTML = `
        <tr><th>Target Final Conc. (pM)</th><th>Target Final Vol. (µL)</th><th>% PhiX</th><th>Pooled Library Vol. (µL)</th><th>PhiX Vol. (µL)</th><th>EB Buffer Vol. (µL)</th></tr>
        <tr><td>${finalTargetConcP}</td><td>${finalTargetVol}</td><td>${phiXpercent}</td><td>${safeLibVol.toFixed(2)}</td><td>${phiXvol.toFixed(2)}</td><td>${safeEbVol.toFixed(2)}</td></tr>`;
    }

    function addInputListeners() {
        document.querySelectorAll('.input-field, .input-field2, #targetConc, #targetVol, #finalTargetConc, #finalTargetVol, #phiXpercent').forEach(field => {
            field.addEventListener('input', updateCalc);
        });
    }

    numLibsSelect.addEventListener('change', () => {
        const prevData = getCurrentInputData(parseInt(numLibsSelect.value));
        createTable(parseInt(numLibsSelect.value), prevData);
        addInputListeners();
        updateCalc();
    });

    downloadBtn.addEventListener('click', () => {
        // Helper to convert a real DOM table to array of arrays, extracting input values if present
        function tableToArrayWithInputsFromDOM(tableElem) {
            const rows = Array.from(tableElem.rows);
            return rows.map(row => Array.from(row.cells).map(cell => {
                const input = cell.querySelector('input');
                return input ? input.value : cell.innerText;
            }));
        }

        // Helper to check if a string is a number (with . or ,)
        function isNumeric(val) {
            return /^-?\d*[\.,]?\d+$/.test(val.trim());
        }
        // Helper to normalize decimal separator to comma
        function normalizeDecimal(val) {
            if (isNumeric(val)) {
                // Replace comma with dot for parse, then back to comma for export
                let num = parseFloat(val.replace(',', '.'));
                if (!isNaN(num)) {
                    // Always use 2 decimals for numbers
                    return num.toFixed(2).replace('.', ',');
                }
            }
            return val;
        }
        // Helper to extract table headers and data, normalizing decimals only for numeric columns
        function tableToArrayWithHeaders(tableElem) {
            const rows = Array.from(tableElem.rows);
            const arr = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const cells = Array.from(row.cells).map((cell, colIdx) => {
                    const input = cell.querySelector('input');
                    let val = input ? input.value : cell.innerText;
                    // Only normalize decimals for columns that are not text headers
                    // PoolTable: columns 0=Library, 1=Library ID, 2=Plate, 3=Qubit Conc, 4=Fragment Length, 5=Pool Area, 6=Molarity, 7=Ratio
                    // ConcTable: 0=Library ID, 1=Quantification, 2=Dilution factor, 3=Dilution conc, 4=Vol to pool, 5=Proportion, 6=Final conc
                    // FinalMixTable: all numeric
                    // For PoolTable: only columns 3-7 are numeric
                    // For ConcTable: only columns 1-6 are numeric
                    // For FinalMixTable: all columns are numeric
                    let isNumericCol = false;
                    if (tableElem === poolTable) {
                        isNumericCol = (colIdx >= 3);
                    } else if (tableElem === concTable) {
                        isNumericCol = (colIdx >= 1);
                    } else if (tableElem === finalMixTable) {
                        isNumericCol = true;
                    }
                    if (isNumericCol && isNumeric(val)) {
                        let num = parseFloat(val.replace(',', '.'));
                        if (!isNaN(num)) {
                            return num.toFixed(2).replace('.', ',');
                        }
                    }
                    return val;
                });
                arr.push(cells);
            }
            return arr;
        }

        // Convert to arrays (with input values and normalized decimals only for numeric columns)
        const poolData = tableToArrayWithHeaders(poolTable);
        const concData = tableToArrayWithHeaders(concTable);
        const finalMixData = tableToArrayWithHeaders(finalMixTable);

        // Combine with blank rows and section headers
        // Add a blank row before each table for Excel visibility
        const sheetData = [];
        sheetData.push(['Pooling']);
        sheetData.push([]); // blank row before table
        sheetData.push(...poolData);
        sheetData.push([]);
        sheetData.push(['Concentrations']);
        sheetData.push([]);
        sheetData.push(...concData);
        sheetData.push([]);
        sheetData.push(['Final Load mixture']);
        sheetData.push([]);
        sheetData.push(...finalMixData);

        // Create worksheet and workbook (just plain tables, no Excel table formatting)
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pooling Data');

        // Download
        XLSX.writeFile(wb, 'pooling_data.xlsx');
    });

    createTable(parseInt(numLibsSelect.value));
    addInputListeners();
    updateCalc();
});
