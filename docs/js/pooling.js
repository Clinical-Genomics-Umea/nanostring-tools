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
        let table = `<tr><th>Library ID</th><th>Quantification<br>(nM)</th><th>Dilution factor</th><th>Dilution conc.<br>(nM)</th><th>Vol. to pool<br>(µL)</th><th>Ratio</th><th>Final conc.<br>(nM)</th></tr>`;

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
            ? `Warning: Total pooled volumes (${sumVols.toFixed(2)} µL) exceed target volume (${targetVol.toFixed(2)} µL). Adjust dilution factors or target volume.`
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
        // Dilution factors
        data.dilfacs = [];
        for (let i = 0; i < num; i++) {
            const dil = document.getElementById(`dilfac2_${i}`);
            data.dilfacs.push(dil ? dil.value : '');
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
            document.getElementById(`library_id_${i}`).value = data.pool[i].library_id || '';
            document.getElementById(`plate_${i}`).value = data.pool[i].plate || '';
            document.getElementById(`qubit_${i}`).value = data.pool[i].qubit || '';
            document.getElementById(`fraglen_${i}`).value = data.pool[i].fraglen || '';
            document.getElementById(`area_${i}`).value = data.pool[i].area || '';
        }
        if (data.targetConc) document.getElementById('targetConc').value = data.targetConc;
        if (data.targetVol) document.getElementById('targetVol').value = data.targetVol;
        if (data.finalTargetConc) document.getElementById('finalTargetConc').value = data.finalTargetConc;
        if (data.finalTargetVol) document.getElementById('finalTargetVol').value = data.finalTargetVol;
        if (data.phiXpercent) document.getElementById('phiXpercent').value = data.phiXpercent;
        // Set dilution factors
        if (data.dilfacs) {
            for (let i = 0; i < data.dilfacs.length; i++) {
                const dil = document.getElementById(`dilfac2_${i}`);
                if (dil && data.dilfacs[i]) dil.value = data.dilfacs[i];
            }
        }
    }

    // Patch updateCalc to save after every change
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

    // Patch addInputListeners to only update calculations, not save
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

    function tableToArrayWithHeaders(tableElem) {
        const rows = Array.from(tableElem.rows);
        const arr = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Only include rows with at least one cell (skip empty rows)
            if (row.cells.length === 0) continue;
            const cells = Array.from(row.cells).map((cell, colIdx) => {
                const input = cell.querySelector('input');
                let val = input ? input.value : cell.textContent;
                // PoolTable: columns 0=Library, 1=Library ID, 2=Plate, 3=Qubit Conc, 4=Fragment Length, 5=Pool Area, 6=Molarity, 7=Ratio
                // ConcTable: 0=Library ID, 1=Quantification, 2=Dilution factor, 3=Dilution conc, 4=Vol to pool, 5=Ratio, 6=Final conc
                // FinalMixTable: all numeric
                let isNumericCol = false;
                let isIntCol = false;
                if (tableElem === poolTable) {
                    isIntCol = (colIdx === 4 || colIdx === 5);
                    isNumericCol = (colIdx >= 3 && !isIntCol);
                } else if (tableElem === concTable) {
                    isNumericCol = (colIdx >= 1);
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
