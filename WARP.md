# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**PDF Sign-o-Matic 3000™ by BadBite** is a client-side web application for visually signing PDFs by placing signature images onto PDF documents. This is an educational/proof-of-concept tool that performs all processing locally in the browser without any server backend.

**⚠️ Educational Purpose Only**: This tool creates visual signatures only - not cryptographically secure digital signatures. It's designed for learning PDF manipulation techniques and should not be used for legally binding documents.

## Architecture Overview

The application is built using pure HTML, CSS, and vanilla JavaScript with two main external libraries:

**Data Flow:**
```
PDF Upload → PDF.js Rendering → User Places Signatures → PDF-lib Export → Download
```

**Core Components:**
- **PDF.js** (v3.11.174): Renders PDF pages to HTML5 Canvas for visual preview
- **PDF-lib** (v1.17.1): Creates the final signed PDF by embedding signature images
- **Single-page app**: All functionality in one HTML file with embedded JavaScript
- **No build process**: Direct CDN dependencies, runs as static files

**Key Technical Details:**
- All processing is client-side (privacy-focused)
- Uses dual coordinate systems: Canvas CSS pixels + PDF points
- High-DPI rendering with devicePixelRatio scaling
- Multi-signature library management with drag-and-drop interface

## Quick Start

### Requirements
- Modern browser (Chrome, Firefox, Safari, Edge)
- Local HTTP server (to avoid CORS issues with file:// protocol)

### Development Commands

**Start local server:**
```bash
# Python 3
python3 -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080

# Node.js (if available)
npx serve -s . -l 8080
```

**Open application:**
```
http://localhost:8080
```

**Test workflow:**
1. Upload a PDF document
2. Upload signature images (PNG/JPG)
3. Click on a signature in the library
4. Click on the PDF preview to place it
5. Download the signed PDF

## PDF Processing Pipeline

### 1. PDF Rendering (PDF.js)
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=94
// Load PDF with PDF-lib for modification
this.pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

// Load PDF with PDF.js for rendering
if (typeof pdfjsLib !== 'undefined') {
    this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}
```

### 2. High-DPI Canvas Rendering
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=286
// Calculate scale to fit within container with high DPI support
const maxWidth = 900;
const maxHeight = 700;
let scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height, 1);

// Increase scale for better quality (but not too high to avoid performance issues)
const devicePixelRatio = window.devicePixelRatio || 1;
const outputScale = Math.min(devicePixelRatio * 2, 3); // Cap at 3x for performance

const scaledViewport = page.getViewport({ scale: scale * outputScale });

// Set canvas size with high DPI
canvas.width = scaledViewport.width;
canvas.height = scaledViewport.height;

// Scale down the display size while keeping high resolution
canvas.style.width = `${scaledViewport.width / outputScale}px`;
canvas.style.height = `${scaledViewport.height / outputScale}px`;
```

### 3. Signature Placement System
The app maintains a placement tracking system:
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=514
// Initialize page signatures if not exists
if (!this.placedSignatures[this.currentPage]) {
    this.placedSignatures[this.currentPage] = [];
}

// Create signature data
const signatureData = {
    id: `placed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    file: this.previewSignature.file,
    position: { x, y },
    size: this.previewSignature.size,
    opacity: this.previewSignature.opacity,
    page: this.currentPage
};
```

### 4. PDF Export (PDF-lib)
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=743
// Convert to PDF coordinates with precise scaling
const pdfX = canvasX * scaleX;
const pdfY = height - (canvasY * scaleY) - (sigHeight * scaleY); // Flip Y and account for signature height
const pdfWidth = sigWidth * scaleX;
const pdfHeight = sigHeight * scaleY;

// Draw signature on PDF with exact positioning
page.drawImage(signatureImage, {
    x: pdfX,
    y: pdfY,
    width: pdfWidth,
    height: pdfHeight,
    opacity: signature.opacity,
});
```

## Coordinate System Conversions

**Critical concept**: The app uses two coordinate systems that must be carefully converted:

### Canvas Coordinates (Display)
- Origin: Top-left corner
- Y-axis: Increases downward
- Units: CSS pixels
- Used for: User interaction, signature placement preview

### PDF Coordinates (Export)
- Origin: Bottom-left corner  
- Y-axis: Increases upward
- Units: Points (1/72 inch)
- Used for: Final PDF generation with PDF-lib

### Conversion Formula
```javascript path=null start=null
// Canvas to PDF coordinate conversion
const scaleX = pdfPageWidth / canvasDisplayWidth;
const scaleY = pdfPageHeight / canvasDisplayHeight;

// X coordinate (same origin)
const pdfX = canvasX * scaleX;

// Y coordinate (flip and scale)
const pdfY = pdfPageHeight - (canvasY * scaleY) - (signatureHeight * scaleY);
```

**Important**: Always use `canvas.style.width/height` (CSS pixels) for coordinate math, not `canvas.width/height` (device pixels).

## File Structure

```
SignPDF/
├── index.html          # Main application file
├── script.js           # Complete application logic (863 lines)
├── style.css           # Styling with gradients and animations
├── README.md           # Project documentation with disclaimers
├── LICENSE             # MIT license
├── .gitignore          # Excludes signature files
└── WARP.md            # This development guide
```

### Script.js Architecture (Single File)

**Main Class: `PDFSignOMatic`**
- **Constructor**: Initializes state, sets up PDF.js worker, binds events
- **File Handling**: 
  - `handlePDFUpload()`: Loads PDF with both PDF.js and PDF-lib
  - `handleMultipleSignatureUpload()`: Manages signature library
- **Rendering**: 
  - `renderPDF()`: High-DPI PDF page rendering to canvas
  - `renderPlacedSignatures()`: Shows placed signatures as overlay elements
- **Interaction**: 
  - `handleMouseMove()`: Signature preview positioning
  - `handleCanvasClick()`: Places signatures at cursor location
- **Export**: 
  - `downloadSignedPDF()`: Converts coordinates and generates final PDF

**Key State Variables:**
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=5
this.pdfFile = null;
this.signatureFiles = []; // Array to store multiple signature files
this.pdfDoc = null;        // PDF-lib document
this.pdfJsDoc = null;      // PDF.js document
this.currentPage = 0;
this.placedSignatures = {}; // Object to store placed signatures by page
this.previewSignature = { file: null, position: { x: 100, y: 100 }, size: 150, opacity: 1 };
this.canvasScale = 1;
this.outputScale = 1;
```

## External Dependencies

**PDF.js v3.11.174:**
```html path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/index.html start=12
<script src="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
```

**PDF-lib v1.17.1:**
```html path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/index.html start=11
<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
```

**Worker Setup:**
```javascript path=/C/Users/User/OneDrive/FAC/Research/Python Scripts/SignPDF/script.js start=16
// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}
```

**Updating Dependencies:**
1. Edit CDN URLs in `index.html`
2. Update worker path in `script.js` 
3. Test thoroughly on all target browsers
4. Consider adding SRI (Subresource Integrity) hashes for security

## Browser Support & Testing

### Target Browsers
- **Desktop**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Android 90+

### Required Browser Features
- Canvas 2D Context with high DPI support
- File API (FileReader, Blob, URL.createObjectURL)
- ES6+ (async/await, arrow functions, const/let)
- Typed Arrays (ArrayBuffer, Uint8Array)

### Manual Testing Checklist
1. **File Upload**: Drag & drop + click to browse for PDFs and images
2. **Rendering**: Multi-page PDFs render correctly at different scales
3. **High DPI**: Crisp rendering on Retina/4K displays 
4. **Placement**: Click-to-place signatures with accurate positioning
5. **Export**: Generated PDF opens correctly in multiple PDF viewers
6. **Multi-signature**: Place multiple signatures on same/different pages
7. **Responsive**: Works on tablet-sized screens

### Common Issues
- **CORS Errors**: Must serve from HTTP server, not file:// protocol
- **Blank Canvas**: Check PDF.js worker URL and browser console
- **Memory Issues**: Large PDFs (>50MB) may cause problems on mobile
- **Coordinate Drift**: Verify DPI scaling and coordinate conversion math

## Development Workflow

### Making Changes
1. **Edit files** directly (no build process)
2. **Hard refresh** browser (Ctrl+Shift+R) to clear cache
3. **Test workflow** end-to-end with sample PDF
4. **Verify export** in multiple PDF viewers

### Adding Features
- **New UI controls**: Add to `.controls` section in HTML, wire up in `initEventListeners()`
- **Signature effects**: Modify rendering in `createPlacedSignatureElement()`
- **Export options**: Extend `downloadSignedPDF()` with PDF-lib features

### Performance Optimization
- **Lazy rendering**: Only render current page, not all pages
- **Object URL cleanup**: Call `URL.revokeObjectURL()` after use
- **Canvas reuse**: Avoid creating new canvas elements unnecessarily
- **DPI awareness**: Balance quality vs performance in `outputScale` calculation

## Security & Privacy

### Client-Side Processing
- **No server uploads**: All PDF processing happens in browser
- **No analytics**: No tracking or data collection
- **Local storage**: Files never leave the user's device

### CDN Dependencies
- **Version pinning**: URLs specify exact versions to avoid supply chain attacks
- **Consider SRI**: Add integrity hashes to script tags for production use
- **HTTPS only**: Ensure CDN resources are served over secure connections

## Troubleshooting

### Common Problems

**"Cannot read property of undefined" errors:**
- Check PDF.js worker is loading correctly
- Verify PDF file is valid and not corrupted

**Signatures appear in wrong positions:**
- Inspect coordinate conversion math in `downloadSignedPDF()`
- Verify canvas display size vs actual size calculations
- Check that `canvasScale` and `outputScale` are computed correctly

**Exported PDF missing signatures:**
- Ensure signature images embed successfully (PNG/JPG format)
- Check console for PDF-lib errors during `drawImage()` calls
- Verify coordinate values are within PDF page bounds

**Poor rendering quality:**
- Check `devicePixelRatio` handling in `renderPDF()`
- Ensure `outputScale` is appropriate for device
- Verify canvas CSS size matches intended display size

### Debug Tools

**Enable debug logging:**
```javascript path=null start=null
window.DEBUG_SIGNATURES = true; // Add to browser console
```

**Inspect key values:**
```javascript path=null start=null
// In browser DevTools console
const app = window.pdfSignOMaticInstance; // If you expose it globally
console.log('Canvas scale:', app.canvasScale);
console.log('Output scale:', app.outputScale);
console.log('Placed signatures:', app.placedSignatures);
```

## Known Limitations

- **Visual signatures only**: No cryptographic digital signing
- **Limited PDF features**: Cannot handle form fields, annotations, or complex layouts
- **Memory constraints**: Very large PDFs may cause browser crashes on mobile
- **No password support**: Cannot open password-protected PDFs
- **Single signature per click**: No batch placement tools

## FAQ

**Q: Why do I need a local server?**
A: Browsers block file:// URLs from loading web workers (PDF.js requirement) due to CORS policy.

**Q: Can I add digital certificate signing?**
A: No, this tool only creates visual signatures. Digital signing requires cryptographic libraries and certificates.

**Q: How do I change the default signature size?**
A: Modify the `previewSignature.size` value in the constructor (line 11 in script.js).

**Q: Can I customize the UI colors/layout?**
A: Yes, edit `style.css`. The app uses CSS custom properties and gradients.

## Glossary

- **Canvas CSS pixels**: The display size of the canvas element (what users see)
- **Canvas device pixels**: The actual bitmap size accounting for devicePixelRatio
- **DPR (Device Pixel Ratio)**: Ratio of device pixels to CSS pixels (2.0 on Retina displays)
- **PDF points**: PDF coordinate units (1/72 inch, standard PDF measurement)
- **Viewport**: PDF.js coordinate mapping between PDF points and canvas pixels
- **SRI (Subresource Integrity)**: Security feature to verify CDN resources haven't been tampered with

---

*This guide covers the essential architecture and development workflow for the PDF Sign-o-Matic 3000 educational tool. For questions about the underlying PDF libraries, consult the PDF.js and PDF-lib documentation.*
