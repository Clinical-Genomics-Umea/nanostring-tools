document.addEventListener('DOMContentLoaded', () => {
    const numLibsSelect = document.getElementById('numLibs');
    const poolTable = document.getElementById('poolTable');
    const downloadBtn = document.getElementById('downloadBtn');
    const concTable = document.getElementById('concTable');
    const wtaReadsDiv = document.getElementById('wtaReads');

    function createTable(num, prevData = []) {
        let html = `<tr>
            <th>Library</th>
            <th>Plate</th>
            <th>Qubit Conc. (ng/µl)</th>
            <th>Fragment Length (bp)</th>
            <th>Pool Area</th>
            <th>Molarity (nM)</th>
            <th>Ratio</th>
        </tr>`;
        for (let i = 0; i < num; i++) {
            const prev = prevData[i] || {};
            html += `<tr>
                <td>Library ${i + 1}</td>
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
        let mols = [], areas = [], ratios = [], dilfacs = [];
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
        // User-settable target volume and target concentration
        if (!window.targetVolInput) {
            const volInput = document.createElement('input');
            volInput.type = 'number';
            volInput.value = window.targetVol || 20.0;
            volInput.min = 0.01;
            volInput.step = 'any';
            volInput.style.width = '5em';
            volInput.addEventListener('input', function() {
                window.targetVol = parseFloat(this.value) || 20.0;
                updateCalc();
            });
            concTable.parentNode.insertBefore(document.createTextNode('Target volume (µL): '), concTable);
            concTable.parentNode.insertBefore(volInput, concTable);
            window.targetVolInput = volInput;
        }
        if (!window.targetConcInput) {
            const concInput = document.createElement('input');
            concInput.type = 'number';
            concInput.value = window.targetConc || 2.0;
            concInput.min = 0.01;
            concInput.step = 'any';
            concInput.style.width = '5em';
            concInput.addEventListener('input', function() {
                window.targetConc = parseFloat(this.value) || 2.0;
                updateCalc();
            });
            concTable.parentNode.insertBefore(document.createTextNode('  Est. diluted mega-pool library conc. (nM): '), concTable);
            concTable.parentNode.insertBefore(concInput, concTable);
            window.targetConcInput = concInput;
        }
        const targetVol = window.targetVolInput.value ? parseFloat(window.targetVolInput.value) : 20.0;
        const targetConc = window.targetConcInput.value ? parseFloat(window.targetConcInput.value) : 2.0;
        let dilutionConcs = [], volsToPool = [], sumVols = 0;
        let table = `<tr><th>#</th><th>Sample ID</th><th>Quantification<br>(nM)</th><th>Dilution factor</th><th>Dilution conc.<br>(nM)</th><th>Vol. to pool<br>(µL)</th><th>Proportion</th><th>Final conc.<br>(nM)</th></tr>`;
        // Only add one row per library
        for (let i = 0; i < num; i++) {
            let dilfacId = `dilfac2_${i}`;
            let prevDilfac = document.getElementById(dilfacId)?.value || 4;
            table += `<tr>` +
                `<td>${i + 1}</td>` +
                `<td>${document.getElementById(`plate_${i}`)?.value || ''}</td>` +
                `<td>${(mols[i]||0).toFixed(2)}</td>` +
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
        table += `<tr><td colspan="6"></td><td>${sumVols > 0 ? '1.000' : ''}</td><td></td></tr>`;
        table += `<tr><td colspan="4"></td><td>Target volume</td><td>${targetVol.toFixed(2)}</td><td colspan="2"></td></tr>`;
        table += `<tr><td colspan="4"></td><td>Est. diluted mega-pool library conc.</td><td>${targetConc.toFixed(2)}</td><td colspan="2"></td></tr>`;
        concTable.innerHTML = table;
        // Add listeners for dilution factor changes in concTable
        for (let i = 0; i < num; i++) {
            document.getElementById(`dilfac2_${i}`).addEventListener('input', updateCalc);
        }
    }

    function addInputListeners() {
        const fields = document.querySelectorAll('.input-field');
        fields.forEach(field => {
            field.addEventListener('input', updateCalc);
        });
    }

    function regenerateTableAndListeners() {
        // Save current data
        const prevData = getCurrentInputData(parseInt(numLibsSelect.value));
        createTable(parseInt(numLibsSelect.value), prevData);
        addInputListeners();
        updateCalc();
    }

    numLibsSelect.addEventListener('change', regenerateTableAndListeners);

    downloadBtn.addEventListener('click', () => {
        const num = parseInt(numLibsSelect.value);
        const rows = [["Library", "Plate", "Qubit (ng/µl)", "Fragment Length", "Pool Area", "Molarity (nM)", "Ratio"]];
        let totalArea = 0;
        for (let i = 0; i < num; i++) {
            totalArea += parseFloat(document.getElementById(`area_${i}`).value) || 0;
        }
        for (let i = 0; i < num; i++) {
            const plate = document.getElementById(`plate_${i}`).value;
            const qubit = parseFloat(document.getElementById(`qubit_${i}`).value) || 0;
            const fraglen = parseFloat(document.getElementById(`fraglen_${i}`).value) || 0;
            const area = parseFloat(document.getElementById(`area_${i}`).value) || 0;
            const mol = (fraglen > 0) ? (qubit * 1000000) / (fraglen * 660) : 0;
            const ratio = totalArea > 0 ? area / totalArea : 0;
            rows.push([
                `Library ${i + 1}`,
                plate,
                qubit,
                fraglen,
                area,
                mol.toFixed(2),
                ratio.toFixed(3)
            ]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pooling Plan");
        XLSX.writeFile(wb, 'geomx_pooling_plan.xlsx');
    });

    // Initial table
    createTable(parseInt(numLibsSelect.value));
    addInputListeners();
    updateCalc();
});
