# DLM Icon Proposals

Five creative icon variants for the Drawing List Manager application, generated
via the SVGMaker API. All icons are 512 × 512 SVG, suitable for conversion to
the PNG / ICO sizes required by Tauri (`icons/32x32.png`, `icons/128x128.png`,
`icons/128x128@2x.png`, `icons/icon.ico`).

| File | Theme | Description |
|------|-------|-------------|
| `dlm-icon-1-blueprint.svg` | Blueprint / Compass | Dark navy background with a compass instrument on an architectural sheet and a gold "R3" revision badge |
| `dlm-icon-2-stacked-sheets.svg` | Stacked Sheets | Three fanned drawing sheets with register lines, green checkmark, and amber revision tag |
| `dlm-icon-3-title-block.svg` | Title Block | Classic engineering drawing border with a DLM title block grid in the corner |
| `dlm-icon-4-monogram.svg` | DLM Monogram | Stylised "DLM" letterform drawn in technical line-work on an indigo/purple gradient |
| `dlm-icon-5-layers.svg` | Revision Layers | Isometric floating layers tagged P1 / IFA / IFC representing drawing revision phases |

## Converting to Tauri bundle icons

Once a design is chosen, generate the required raster sizes:

```bash
# Using Inkscape (adjust the source file name as needed)
inkscape --export-type=png --export-width=32  --export-filename=../32x32.png   dlm-icon-X.svg
inkscape --export-type=png --export-width=128 --export-filename=../128x128.png dlm-icon-X.svg
inkscape --export-type=png --export-width=256 --export-filename=../128x128@2x.png dlm-icon-X.svg
# Then convert 256 × 256 PNG → ICO with ImageMagick:
convert ../128x128@2x.png ../icon.ico
```
