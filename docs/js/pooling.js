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
        let table = `<tr><th>#</th><th>Sample ID</th><th>Quantification<br>(nM)</th><th>Dilution factor</th><th>Dilution conc.<br>(nM)</th><th>Vol. to pool<br>(µL)</th><th>Proportion</th><th>Final conc.<br>(nM)</th></tr>`;

        for (let i = 0; i < num; i++) {
            let dilfacId = `dilfac2_${i}`;
            let prevDilfac = document.getElementById(dilfacId)?.value || 4;
            table += `<tr><td>${i + 1}</td><td>${document.getElementById(`plate_${i}`).value}</td><td>${mols[i].toFixed(2)}</td>` +
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
        // ... your download logic ...
    });

    createTable(parseInt(numLibsSelect.value));
    addInputListeners();
    updateCalc();
});
