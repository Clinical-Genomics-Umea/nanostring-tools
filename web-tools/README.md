# nanostring-tools at Clinical Genomics Umeå

Helper tools for NanoString platforms developed and used at Clinical Genomics Umeå.  
This repository contains browser-based utilities, Excel templates, and supporting files for working with GeoMx and related platforms.

## Repository Structure

| Folder           | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `web-tools/`     | Web-based tools that run directly in the browser, no installation |
| `excel-templates/` | Useful Excel templates for sample pooling     |
| `docker/`        | (Planned) Docker containers for pipeline components and tools      |

## Web Tools

Located under `web-tools/`.

| Tool | Description | Link |
|------|-------------|------|
| Worksheet per Plate Parser | Parses tab-delimited GeoMx `.txt` files. Groups entries by `Collection Plate` and generates a `.xlsx` file with one sheet per plate, including total AOI count and area. | [Launch Tool](https://clinical-genomics-umea.github.io/nanostring-tools/) |

These tools run entirely in the browser. No data is transmitted or stored externally, making them suitable for clinical or internal research use.


## Maintainers

Developed and maintained by the Clinical Genomics Umeå team.

For questions or suggestions, contact:
`adam.rosenbaum@regionvasterbotten.se`