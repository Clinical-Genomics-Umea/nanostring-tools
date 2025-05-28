/**
 * GeoMx Worksheet per Plate Parser
 * Version: 1.1.0
 * Date: 2025-05-28
 * Description: Parses tab-delimited GeoMx files and exports .xlsx with sheets per Collection Plate.
 * Author: Adam Rosenbaum, Clinical Genomics Umeå
 * Repo: https://github.com/Clinical-Genomics-Umea/nanostring-tools
 */

function processFile() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) return alert('Please choose a file first.');

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r?\n/);
        let headers = [];
        const plates = {};

        // Find header row
        let startIdx = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("Sample_ID")) {
                headers = lines[i].split("\t");
                startIdx = i + 1;
                break;
            }
        }

        // Group lines by Collection Plate
        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split("\t");
            if (parts.length < 8) continue;

            const sampleID = parts[0];
            if (!sampleID.includes("-")) continue;

            const plate = sampleID.split("-")[1];
            if (!plates[plate]) plates[plate] = [];
            plates[plate].push(parts);
        }

        // Create workbook
        const wb = XLSX.utils.book_new();

        Object.entries(plates).forEach(([plate, rows]) => {
            const data = [headers];
            let totalArea = 0;
            let count = 0;

            rows.forEach(r => {
                data.push(r);
                const rawArea = r[7].replace(',', '.');
                const area = parseFloat(rawArea);
                if (!isNaN(area)) {
                    totalArea += area;
                    count++;
                }
            });

            // Add summary on top
            data.unshift([
                `Collection Plate: ${plate}`,
                `Total AOIs: ${count}`,
                `Total Area: ${totalArea.toFixed(2)}`
            ]);

            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, plate.substring(0, 31));
        });

        // Download the Excel file
        XLSX.writeFile(wb, 'GeoMx_plates.xlsx');
    };

    reader.readAsText(file);
}