# DLM Icon Proposals

Five creative titleblock icon variants for the Drawing List Manager application,
generated via the SVGMaker API. Every variant is centred on the **DLM titleblock**
motif — the grid of cells that appear in the corner of an engineering drawing sheet —
but each is styled completely differently. All icons are square SVG, suitable for
conversion to the PNG / ICO sizes required by Tauri (`icons/32x32.png`,
`icons/128x128.png`, `icons/128x128@2x.png`, `icons/icon.ico`).

| File | Theme | Description |
|------|-------|-------------|
| `dlm-icon-1-titleblock-dark.svg` | Dark Industrial | Charcoal background with electric-blue accents; classic A3 frame, thick outer border, and a detailed "DLM" titleblock grid in the lower-right |
| `dlm-icon-2-titleblock-blueprint.svg` | Blueprint Line Art | White line art on deep navy; full blueprint-style titleblock with revision table, "R3P-001" drawing number, and cyan-glow border |
| `dlm-icon-3-titleblock-minimal.svg` | Minimalist Swiss | Pure white, monochrome; ultra-clean Helvetica-style "DLM" bold in a single-strip titleblock — no decoration, mathematical precision |
| `dlm-icon-4-titleblock-vintage.svg` | Vintage Engraving | Aged parchment background with sepia ink; Victorian-era double border, ornate corner brackets, serif "D.L.M." lettering, and a compass rose |
| `dlm-icon-5-titleblock-neon.svg` | Neon Futuristic | Black background; glowing teal/cyan border frame, magenta "DLM" neon lettering, amber revision cells (IFC / IFA / P1), scanline HUD grid |

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
