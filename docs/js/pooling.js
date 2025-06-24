document.addEventListener('DOMContentLoaded', () => {
    const numLibsSelect = document.getElementById('numLibs');
    const poolTable = document.getElementById('poolTable');
    const downloadBtn = document.getElementById('downloadBtn');
    const concTable = document.getElementById('concTable');
    const wtaReadsDiv = document.getElementById('wtaReads');
    const finalMixTable = document.getElementById('finalMixTable');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');

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
                <td>${i + 1}</td>
                <td><input type="text" id="library_id_${i}" value="${prev.library_id || ''}"></td>
                <td><input type="text" id="plate_${i}" value="${prev.plate || ''}"></td>
                <td><input type="number" step="any" id="qubit_${i}" class="input-field" value="${prev.qubit || ''}"></td>
                <td><input type="number" step="any" id="fraglen_${i}" class="input-field" value="${prev.fraglen || 162}"></td>
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

    function updateCalc(desiredConcsFromStore = null, desiredVolsFromStore = null) {
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
        renderConcTable(num, mols, areas, ratios, totalArea, desiredConcsFromStore, desiredVolsFromStore);
    }

    function renderConcTable(num, mols, areas, ratios, totalArea, desiredConcsFromStore = null, desiredVolsFromStore = null) {
        const targetFinalVol = parseFloat(document.getElementById('finalTargetVol')?.value) || 20.0;
        const targetFinalConc = parseFloat(document.getElementById('finalTargetConc')?.value) || 2.0;
        let desiredConcs = [], desiredVols = [], libVols = [], ebVols = [], volToPools = [];
        // Calculate the denominator for normalization: sum(ratio / desiredConc)
        let normDenom = 0;
        for (let i = 0; i < num; i++) {
            let desiredConc;
            if (desiredConcsFromStore && desiredConcsFromStore[i] !== undefined && desiredConcsFromStore[i] !== '') {
                desiredConc = parseFloat(desiredConcsFromStore[i]);
            } else {
                let desiredConcId = `desiredConc_${i}`;
                let prevDesiredConc = document.getElementById(desiredConcId)?.value || '';
                desiredConc = parseFloat(prevDesiredConc);
            }
            if (isNaN(desiredConc) || desiredConc <= 0) desiredConc = 2.0;
            desiredConcs[i] = desiredConc;
            normDenom += ratios[i] / desiredConc;
        }
        // Calculate vol to pool for each library: (ratio / desiredConc) / normDenom * targetFinalVol
        let table = `<tr><th>Library ID</th><th>Start Conc.<br>(nM)</th><th>Desired Conc.<br>(nM)</th><th>Desired Vol.<br>(µL)</th><th>Lib Vol to mix<br>(µL)</th><th>EB Vol to mix<br>(µL)</th><th>Vol. to pool<br>(µL)</th><th>Ratio</th></tr>`;
        let sumVolsToPool = 0;
        let volWarnings = [];
        for (let i = 0; i < num; i++) {
            let desiredVol;
            if (desiredVolsFromStore && desiredVolsFromStore[i] !== undefined && desiredVolsFromStore[i] !== '') {
                desiredVol = parseFloat(desiredVolsFromStore[i]);
            } else {
                let desiredVolId = `desiredVol_${i}`;
                let prevDesiredVol = document.getElementById(desiredVolId)?.value || '';
                desiredVol = parseFloat(prevDesiredVol);
            }
            if (isNaN(desiredVol) || desiredVol <= 0) desiredVol = 20.0;
            // Calculate how much original library to use to make this dilution
            const libVolToMix = (desiredConcs[i] > 0 && mols[i] > 0) ? (desiredVol * desiredConcs[i]) / mols[i] : 0;
            const ebVolToMix = desiredVol - libVolToMix;
            // Normalized vol to pool
            const volToPool = ((ratios[i] / desiredConcs[i]) / normDenom) * targetFinalVol;
            volToPools[i] = volToPool;
            table += `<tr><td id="conc_library_id_${i}">${document.getElementById(`library_id_${i}`)?.value || ''}</td>` +
                `<td id="conc_mol_${i}">${mols[i].toFixed(2)}</td>` +
                `<td><input type="number" step="any" id="desiredConc_${i}" class="input-field2 conc-input" value="${desiredConcs[i]}" min="0.01"></td>` +
                `<td><input type="number" step="any" id="desiredVol_${i}" class="input-field2 vol-input" value="${desiredVol.toFixed(2)}" min="0.01"></td>` +
                `<td id="libvol_${i}">${libVolToMix.toFixed(2)}</td>` +
                `<td id="ebvol_${i}">${ebVolToMix.toFixed(2)}</td>` +
                `<td id="voltopool_${i}">${volToPool.toFixed(2)}</td>` +
                `<td id="conc_ratio_${i}">${ratios[i].toFixed(3)}</td></tr>`;
            sumVolsToPool += volToPool;
            if (desiredVol < volToPool - 0.01) {
                volWarnings.push(`Library ${document.getElementById(`library_id_${i}`)?.value || (i+1)}: Desired volume (${desiredVol.toFixed(2)} µL) is less than volume to pool (${volToPool.toFixed(2)} µL)`);
            }
        }
        concTable.innerHTML = table;
        let warningMsg = '';
        if (Math.abs(sumVolsToPool - targetFinalVol) > 0.01) {
            warningMsg += `Note: Volumes to pool sum to ${sumVolsToPool.toFixed(2)} µL (target: ${targetFinalVol} µL).`;
        }
        if (volWarnings.length > 0) {
            if (warningMsg) warningMsg += ' ';
            warningMsg += volWarnings.join(' | ');
        }
        warningDiv.textContent = warningMsg;
        for (let i = 0; i < num; i++) {
            document.getElementById(`desiredConc_${i}`).addEventListener('input', updateCalcAndSave);
            document.getElementById(`desiredVol_${i}`).addEventListener('input', updateCalcAndSave);
        }
        // Calculate effective pool concentration for final mix table
        let poolConc = 0, totalRatio = 0;
        for (let i = 0; i < num; i++) {
            if (!isNaN(desiredConcs[i]) && desiredConcs[i] > 0) {
                poolConc += desiredConcs[i] * ratios[i];
                totalRatio += ratios[i];
            }
        }
        if (totalRatio > 0) poolConc = poolConc / totalRatio;
        else poolConc = desiredConcs[0] || 2.0;
        updateFinalMixTable(poolConc);
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

    // Save all input values to localStorage
    function saveInputsToStorage() {
        const num = parseInt(numLibsSelect.value);
        const data = {
            numLibs: num,
            pool: []
        };
        for (let i = 0; i < num; i++) {
            data.pool.push({
                library_id: document.getElementById(`library_id_${i}`)?.value || '',
                plate: document.getElementById(`plate_${i}`)?.value || '',
                qubit: document.getElementById(`qubit_${i}`)?.value || '',
                fraglen: document.getElementById(`fraglen_${i}`)?.value || '',
                area: document.getElementById(`area_${i}`)?.value || ''
            });
        }
        // Other controls
        data.targetConc = document.getElementById('targetConc')?.value || '';
        data.targetVol = document.getElementById('targetVol')?.value || '';
        data.finalTargetConc = document.getElementById('finalTargetConc')?.value || '';
        data.finalTargetVol = document.getElementById('finalTargetVol')?.value || '';
        data.phiXpercent = document.getElementById('phiXpercent')?.value || '';
        // Desired concentrations and volumes
        data.desiredConcs = [];
        data.desiredVols = [];
        for (let i = 0; i < num; i++) {
            const conc = document.getElementById(`desiredConc_${i}`);
            const vol = document.getElementById(`desiredVol_${i}`);
            data.desiredConcs.push(conc ? conc.value : '');
            data.desiredVols.push(vol ? vol.value : '');
        }
        localStorage.setItem('poolingToolData', JSON.stringify(data));
    }

    // Load all input values from localStorage
    function loadInputsFromStorage() {
        const data = JSON.parse(localStorage.getItem('poolingToolData') || 'null');
        if (!data) return;
        // Set number of libraries
        numLibsSelect.value = data.numLibs || numLibsSelect.value;
        createTable(parseInt(numLibsSelect.value), data.pool || []);
        // Set pool table values
        for (let i = 0; i < (data.pool || []).length; i++) {
            const libId = document.getElementById(`library_id_${i}`);
            const plate = document.getElementById(`plate_${i}`);
            const qubit = document.getElementById(`qubit_${i}`);
            const fraglen = document.getElementById(`fraglen_${i}`);
            const area = document.getElementById(`area_${i}`);
            if (libId) libId.value = data.pool[i].library_id || '';
            if (plate) plate.value = data.pool[i].plate || '';
            if (qubit) qubit.value = data.pool[i].qubit || '';
            if (fraglen) fraglen.value = data.pool[i].fraglen || '';
            if (area) area.value = data.pool[i].area || '';
        }
        if (data.targetConc && document.getElementById('targetConc')) document.getElementById('targetConc').value = data.targetConc;
        if (data.targetVol && document.getElementById('targetVol')) document.getElementById('targetVol').value = data.targetVol;
        if (data.finalTargetConc && document.getElementById('finalTargetConc')) document.getElementById('finalTargetConc').value = data.finalTargetConc;
        if (data.finalTargetVol && document.getElementById('finalTargetVol')) document.getElementById('finalTargetVol').value = data.finalTargetVol;
        if (data.phiXpercent && document.getElementById('phiXpercent')) document.getElementById('phiXpercent').value = data.phiXpercent;
        // Set desired concentrations and volumes by passing them to updateCalc
        updateCalc(data.desiredConcs || null, data.desiredVols || null);
    }

    function updateCalcAndSave() {
        updateCalc();
        saveInputsToStorage();
    }

    // Add a Save button for manual saving
    function addSaveButton() {
        if (document.getElementById('saveSessionBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'saveSessionBtn';
        btn.textContent = 'Save Session';
        btn.style.marginLeft = '1em';
        btn.style.marginTop = '1em';
        btn.addEventListener('click', () => {
            saveInputsToStorage();
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save Session'; }, 1200);
        });
        // Insert after the PDF button
        const pdfBtn = document.getElementById('downloadPdfBtn');
        pdfBtn.parentNode.insertBefore(btn, pdfBtn.nextSibling);
    }

    // Remove the controls for targetConc and targetVol above the second table
    const targetConcInput = document.getElementById('targetConc');
    const targetVolInput = document.getElementById('targetVol');
    if (targetConcInput) targetConc.parentNode.removeChild(targetConcInput);
    if (targetVolInput) targetVol.parentNode.removeChild(targetVolInput);
    const targetConcLabel = document.querySelector('label[for="targetConc"]');
    if (targetConcLabel) targetConcLabel.parentNode.removeChild(targetConcLabel);
    const targetVolLabel = document.querySelector('label[for="targetVol"]');
    if (targetVolLabel) targetVolLabel.parentNode.removeChild(targetVolLabel);

    // Patch addInputListeners to update the second table when any input in the second or third table changes
    function addInputListeners() {
        document.querySelectorAll('.input-field, .input-field2').forEach(field => {
            field.addEventListener('input', updateCalc);
        });
        // Add listeners for dynamically created desiredConc and desiredVol fields
        const num = parseInt(numLibsSelect.value);
        for (let i = 0; i < num; i++) {
            const conc = document.getElementById(`desiredConc_${i}`);
            const vol = document.getElementById(`desiredVol_${i}`);
            if (conc) conc.addEventListener('input', updateCalc);
            if (vol) vol.addEventListener('input', updateCalc);
        }
        // Add listeners for final table controls
        document.getElementById('finalTargetConc')?.addEventListener('input', updateCalc);
        document.getElementById('finalTargetVol')?.addEventListener('input', updateCalc);
        document.getElementById('phiXpercent')?.addEventListener('input', updateCalc);
    }

    numLibsSelect.addEventListener('change', () => {
        const prevData = getCurrentInputData(parseInt(numLibsSelect.value));
        createTable(parseInt(numLibsSelect.value), prevData);
        addInputListeners();
        updateCalc();
    });

    function tableToArrayWithHeaders(tableElem) {
        const rows = Array.from(tableElem.rows);
        const arr = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.cells.length === 0) continue;
            const cells = Array.from(row.cells).map((cell, colIdx) => {
                const input = cell.querySelector('input');
                let val = input ? input.value : cell.textContent;
                // PoolTable: columns 0=Library, 1=Library ID, 2=Plate, 3=Qubit Conc, 4=Fragment Length, 5=Pool Area, 6=Molarity, 7=Ratio
                // ConcTable: 0=Library ID, 1=Start Conc, 2=Desired Conc, 3=Desired Vol, 4=Lib Vol to mix, 5=EB Vol to mix, 6=Vol to pool, 7=Ratio, 8=Final conc
                // FinalMixTable: all numeric
                let isNumericCol = false;
                let isIntCol = false;
                if (tableElem === poolTable) {
                    isIntCol = (colIdx === 4 || colIdx === 5);
                    isNumericCol = (colIdx >= 3 && !isIntCol);
                } else if (tableElem === concTable) {
                    isNumericCol = (colIdx >= 1 && colIdx <= 8);
                } else if (tableElem === finalMixTable) {
                    isNumericCol = true;
                }
                if (isIntCol && /^-?\d+([\.,]\d+)?$/.test(val.trim())) {
                    let num = parseFloat(val.replace(',', '.'));
                    if (!isNaN(num)) {
                        return Math.round(num).toString();
                    }
                } else if (isNumericCol && /^-?\d*[\.,]?\d+$/.test(val.trim())) {
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

    function getAllTableData() {
        return {
            poolData: tableToArrayWithHeaders(poolTable),
            concData: tableToArrayWithHeaders(concTable),
            finalMixData: tableToArrayWithHeaders(finalMixTable)
        };
    }

    downloadBtn.addEventListener('click', () => {
        const { poolData, concData, finalMixData } = getAllTableData();

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

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pooling Data');

        XLSX.writeFile(wb, 'pooling_data.xlsx');
    });

    downloadPdfBtn.addEventListener('click', () => {
        const { poolData, concData, finalMixData } = getAllTableData();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text('GeoMx Pooling Plan Report', 14, 16);

        var y = 24;

        let totalArea = 0;
        for (let i = 1; i < poolData.length; i++) { // skip header row
            const areaStr = poolData[i][5];
            const area = parseFloat((areaStr || '0').replace(',', '.'));
            if (!isNaN(area)) totalArea += area;
        }

        if (poolData.length > 1) {
            doc.setFontSize(12);
            doc.text('Pooling', 14, y);
            doc.autoTable({
                startY: y + 4,
                head: [poolData[0]],
                body: poolData.slice(1),
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        const totalReads = Math.round(totalArea * 100);
        doc.setFontSize(12);
        doc.text(`Estimated WTA reads: ${totalReads.toLocaleString()} reads`, 14, y);
        y += 10;

        if (concData.length > 1) {
            doc.text('Concentrations', 14, y);
            doc.autoTable({
                startY: y + 4,
                head: [concData[0]],
                body: concData.slice(1),
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });
            y = doc.lastAutoTable.finalY + 10;
        }
        
        if (finalMixData.length > 1) {
            doc.text('Final Load mixture', 14, y);
            doc.autoTable({
                startY: y + 4,
                head: [finalMixData[0]],
                body: finalMixData.slice(1),
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });
            y = doc.lastAutoTable.finalY + 10;
        }

        doc.setFontSize(12);
        doc.text('Sequencing Specifications / Comments:', 14, y);
        doc.setDrawColor(100);
        doc.rect(14, y + 4, 180, 40);
        doc.setFontSize(10);
        doc.text('', 16, y + 16);

        doc.save('pooling_report.pdf');
    });

    createTable(parseInt(numLibsSelect.value));
    addSaveButton();
    loadInputsFromStorage();
    updateCalc();
    addInputListeners();
});
