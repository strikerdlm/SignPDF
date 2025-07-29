

class PDFSignOMatic {
    constructor() {
        this.pdfFile = null;
        this.signatureFiles = []; // Array to store multiple signature files
        this.pdfDoc = null;
        this.pdfJsDoc = null;
        this.currentPage = 0;
        this.placedSignatures = {}; // Object to store placed signatures by page
        this.previewSignature = { file: null, position: { x: 100, y: 100 }, size: 150, opacity: 1 };
        this.canvasScale = 1;
        this.outputScale = 1;
        this.activeSignatureIndex = 0; // Track which signature is being placed
        
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }
        
        this.initEventListeners();
    }

    initEventListeners() {
        // PDF Upload
        const pdfUpload = document.getElementById('pdfUpload');
        const pdfInput = document.getElementById('pdfInput');
        
        pdfUpload.addEventListener('click', () => pdfInput.click());
        pdfUpload.addEventListener('dragover', this.handleDragOver.bind(this));
        pdfUpload.addEventListener('drop', (e) => this.handleDrop(e, 'pdf'));
        pdfInput.addEventListener('change', (e) => this.handlePDFUpload(e.target.files[0]));

        // Signature Upload
        const signatureUpload = document.getElementById('signatureUpload');
        const signatureInput = document.getElementById('signatureInput');
        
        signatureUpload.addEventListener('click', () => signatureInput.click());
        signatureUpload.addEventListener('dragover', this.handleDragOver.bind(this));
        signatureUpload.addEventListener('drop', (e) => this.handleDrop(e, 'signature'));
        signatureInput.addEventListener('change', (e) => this.handleMultipleSignatureUpload(e.target.files));

        // Controls
        document.getElementById('pageSelect').addEventListener('change', this.handlePageChange.bind(this));
        document.getElementById('signatureSize').addEventListener('input', this.handleSizeChange.bind(this));
        document.getElementById('signatureOpacity').addEventListener('input', this.handleOpacityChange.bind(this));

        // Action Buttons
        document.getElementById('downloadBtn').addEventListener('click', this.downloadSignedPDF.bind(this));
        document.getElementById('resetBtn').addEventListener('click', this.reset.bind(this));
        document.getElementById('clearAllBtn').addEventListener('click', this.clearAllSignatures.bind(this));

        // Signature positioning
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('click', this.handleCanvasClick.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e, type) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            if (type === 'pdf') {
                const file = files[0];
                if (file.type === 'application/pdf') {
                    this.handlePDFUpload(file);
                } else {
                    this.showError('Please upload a valid PDF file.');
                }
            } else if (type === 'signature') {
                const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    this.handleMultipleSignatureUpload(imageFiles);
                } else {
                    this.showError('Please upload valid image files.');
                }
            }
        }
    }

    async handlePDFUpload(file) {
        if (!file) return;
        
        try {
            this.showLoading('pdfUpload');
            
            const arrayBuffer = await file.arrayBuffer();
            
            // Load PDF with PDF-lib for modification
            this.pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Load PDF with PDF.js for rendering
            if (typeof pdfjsLib !== 'undefined') {
                this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            }
            
            this.pdfFile = file;
            
            this.markUploaded('pdfUpload', '📄 PDF Loaded!');
            this.populatePageSelect();
            await this.renderPDF();
            this.checkIfReadyToPreview();
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showError('Failed to load PDF. Please try a different file.');
            // Reset upload area on error
            this.resetUploadArea('pdfUpload');
        }
    }
    
    resetUploadArea(elementId) {
        const element = document.getElementById(elementId);
        element.classList.remove('uploaded');
        const content = element.querySelector('.upload-content');
        
        if (elementId === 'pdfUpload') {
            content.innerHTML = `
                <div class="upload-icon">📄</div>
                <h3>Upload PDF Document</h3>
                <p>Drop your PDF here or click to browse</p>
            `;
        } else {
            content.innerHTML = `
                <div class="upload-icon">✍️</div>
                <h3>Upload Signature Image</h3>
                <p>Drop your PNG signature here or click to browse</p>
            `;
        }
    }

    async handleMultipleSignatureUpload(files) {
        if (!files || files.length === 0) return;
        
        try {
            this.showLoading('signatureUpload');
            
            const fileArray = Array.isArray(files) ? files : Array.from(files);
            
            for (const file of fileArray) {
                if (file.type.startsWith('image/')) {
                    const signatureId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    this.signatureFiles.push({
                        id: signatureId,
                        file: file,
                        name: file.name
                    });
                }
            }
            
            this.updateSignatureLibrary();
            this.markUploaded('signatureUpload', `✍️ Added ${fileArray.length} signature(s)!`);
            this.checkIfReadyToPreview();
            
        } catch (error) {
            console.error('Error loading signatures:', error);
            this.showError('Failed to load signature images.');
            this.resetUploadArea('signatureUpload');
        }
    }
    
    updateSignatureLibrary() {
        const signaturesList = document.getElementById('signaturesList');
        const signaturesGrid = document.getElementById('signaturesGrid');
        
        if (this.signatureFiles.length === 0) {
            signaturesList.style.display = 'none';
            return;
        }
        
        signaturesList.style.display = 'block';
        signaturesGrid.innerHTML = '';
        
        this.signatureFiles.forEach((signature, index) => {
            const signatureItem = document.createElement('div');
            signatureItem.className = 'signature-item';
            signatureItem.dataset.signatureId = signature.id;
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(signature.file);
            img.alt = signature.name;
            
            const name = document.createElement('div');
            name.className = 'signature-name';
            name.textContent = signature.name.length > 15 ? signature.name.substring(0, 15) + '...' : signature.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeSignatureFromLibrary(signature.id);
            };
            
            signatureItem.appendChild(img);
            signatureItem.appendChild(name);
            signatureItem.appendChild(removeBtn);
            
            signatureItem.addEventListener('click', () => {
                this.selectSignatureForPlacement(signature, index);
            });
            
            signaturesGrid.appendChild(signatureItem);
        });
    }
    
    selectSignatureForPlacement(signature, index) {
        // Remove active class from all signature items
        document.querySelectorAll('.signature-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to selected item
        const selectedItem = document.querySelector(`[data-signature-id="${signature.id}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
        
        // Set preview signature
        this.previewSignature.file = signature.file;
        this.activeSignatureIndex = index;
        
        // Show preview
        this.showSignaturePreview();
    }
    
    removeSignatureFromLibrary(signatureId) {
        this.signatureFiles = this.signatureFiles.filter(sig => sig.id !== signatureId);
        this.updateSignatureLibrary();
        
        // Clear preview if this signature was selected
        if (this.previewSignature.file) {
            const activeSignature = this.signatureFiles.find(sig => sig.file === this.previewSignature.file);
            if (!activeSignature) {
                this.previewSignature.file = null;
                this.hideSignaturePreview();
            }
        }
        
        this.checkIfReadyToPreview();
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        const content = element.querySelector('.upload-content');
        content.innerHTML = '<div class="loading"></div><p>Loading...</p>';
    }

    markUploaded(elementId, message) {
        const element = document.getElementById(elementId);
        element.classList.add('uploaded');
        const content = element.querySelector('.upload-content');
        content.innerHTML = `<div class="upload-icon">✅</div><h3>${message}</h3>`;
    }

    populatePageSelect() {
        const pageSelect = document.getElementById('pageSelect');
        pageSelect.innerHTML = '';
        
        const pageCount = this.pdfJsDoc ? this.pdfJsDoc.numPages : this.pdfDoc.getPageCount();
        for (let i = 0; i < pageCount; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Page ${i + 1}`;
            pageSelect.appendChild(option);
        }
    }

    async renderPDF() {
        if (!this.pdfJsDoc) return;
        
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        
        try {
            // Get the page from PDF.js
            const page = await this.pdfJsDoc.getPage(this.currentPage + 1); // PDF.js uses 1-based indexing
            const viewport = page.getViewport({ scale: 1 });
            
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
            
            // Store the actual scale for coordinate conversion
            this.canvasScale = scale;
            this.outputScale = outputScale;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Scale the context to match the output scale
            ctx.scale(outputScale, outputScale);
            
            // Render PDF page
            const renderContext = {
                canvasContext: ctx,
                viewport: page.getViewport({ scale })
            };
            
            await page.render(renderContext).promise;
            
            // Update signature preview after rendering
            this.updateSignaturePreview();
            
            // Render placed signatures
            this.renderPlacedSignatures();
            
        } catch (error) {
            console.error('Error rendering PDF:', error);
            // Fallback to placeholder if rendering fails
            this.renderPlaceholder(canvas, ctx);
        }
    }
    
    renderPlaceholder(canvas, ctx) {
        // Fallback placeholder rendering with high DPI
        const devicePixelRatio = window.devicePixelRatio || 1;
        const outputScale = Math.min(devicePixelRatio * 2, 3);
        
        const displayWidth = 600;
        const displayHeight = 800;
        
        canvas.width = displayWidth * outputScale;
        canvas.height = displayHeight * outputScale;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        ctx.scale(outputScale, outputScale);
        
        this.canvasScale = 1;
        this.outputScale = outputScale;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, displayWidth, displayHeight);
        ctx.strokeStyle = '#cccccc';
        ctx.strokeRect(0, 0, displayWidth, displayHeight);
        
        ctx.fillStyle = '#666666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`PDF Page ${this.currentPage + 1}`, displayWidth / 2, displayHeight / 2);
        ctx.fillText('(Preview unavailable - actual PDF content will be preserved)', displayWidth / 2, displayHeight / 2 + 30);
        
        this.updateSignaturePreview();
        this.renderPlacedSignatures();
    }

    checkIfReadyToPreview() {
        if (this.pdfFile && this.signatureFiles.length > 0) {
            document.getElementById('previewSection').style.display = 'block';
            this.renderPlacedSignatures();
        }
    }

    async showSignaturePreview() {
        if (!this.previewSignature.file) return;
        
        const signaturePreview = document.getElementById('signaturePreview');
        
        // Create image element for signature
        const img = document.createElement('img');
        img.src = URL.createObjectURL(this.previewSignature.file);
        
        signaturePreview.innerHTML = '';
        signaturePreview.appendChild(img);
        signaturePreview.classList.add('visible');
        
        this.updateSignaturePreview();
    }
    
    hideSignaturePreview() {
        const signaturePreview = document.getElementById('signaturePreview');
        signaturePreview.classList.remove('visible');
        signaturePreview.innerHTML = '';
    }

    updateSignaturePreview() {
        const signaturePreview = document.getElementById('signaturePreview');
        
        if (!signaturePreview.classList.contains('visible')) return;
        
        // Use utility method for precise offset calculation
        const offset = this.getCanvasToContainerOffset();
        
        // Position signature preview exactly where it will be placed
        const previewX = offset.x + this.previewSignature.position.x;
        const previewY = offset.y + this.previewSignature.position.y;
        
        signaturePreview.style.left = `${previewX}px`;
        signaturePreview.style.top = `${previewY}px`;
        signaturePreview.style.width = `${this.previewSignature.size}px`;
        signaturePreview.style.height = `${this.previewSignature.size * 0.5}px`;
        signaturePreview.style.opacity = this.previewSignature.opacity;
        
        // Ensure proper layering and interaction
        signaturePreview.style.pointerEvents = 'none';
        signaturePreview.style.zIndex = '15';
        signaturePreview.style.position = 'absolute';
    }

    handlePageChange(e) {
        this.currentPage = parseInt(e.target.value);
        this.renderPDF();
        this.renderPlacedSignatures(); // Re-render signatures for new page
        this.updatePlacedSignaturesInfo();
    }

    handleSizeChange(e) {
        this.previewSignature.size = parseInt(e.target.value);
        document.getElementById('sizeValue').textContent = `${this.previewSignature.size}px`;
        this.updateSignaturePreview();
    }

    handleOpacityChange(e) {
        this.previewSignature.opacity = parseFloat(e.target.value);
        document.getElementById('opacityValue').textContent = `${Math.round(this.previewSignature.opacity * 100)}%`;
        this.updateSignaturePreview();
    }

    handleMouseMove(e) {
        const canvas = document.getElementById('pdfCanvas');
        const container = document.querySelector('.pdf-container');
        
        if (e.target === canvas || e.target.closest('.pdf-container')) {
            // Only show preview if a signature is selected
            if (!this.previewSignature.file) {
                canvas.style.cursor = 'default';
                return;
            }
            
            // Get accurate canvas position accounting for borders, padding, and scaling
            const rect = canvas.getBoundingClientRect();
            
            // Calculate mouse position relative to the actual canvas display area
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            // Check if mouse is within canvas bounds
            if (canvasX >= 0 && canvasX <= rect.width && canvasY >= 0 && canvasY <= rect.height) {
                // Calculate centered position
                const rawPosition = {
                    x: canvasX - this.previewSignature.size / 2,
                    y: canvasY - (this.previewSignature.size * 0.5) / 2
                };
                
                // Validate and clamp position to canvas bounds
                const validatedPosition = this.validateSignaturePosition(rawPosition, this.previewSignature.size, rect);
                
                // Store the validated coordinates for precise placement
                this.previewSignature.position.x = validatedPosition.x;
                this.previewSignature.position.y = validatedPosition.y;
                
                this.updateSignaturePreview();
                
                // Change cursor to indicate signature can be placed
                canvas.style.cursor = 'crosshair';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    }

    handleCanvasClick(e) {
        const canvas = document.getElementById('pdfCanvas');
        
        // Check if clicking on an existing placed signature first
        if (e.target.closest('.placed-signature')) {
            return; // Let the placed signature handle its own clicks
        }
        
        if (e.target === canvas && this.previewSignature.file) {
            // Get exact click position using the same method as mouse move
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Ensure click is within canvas bounds
            if (clickX >= 0 && clickX <= rect.width && clickY >= 0 && clickY <= rect.height) {
                // Use the current preview position for perfect alignment
                // This ensures what you see is exactly what you get
                const finalX = this.previewSignature.position.x;
                const finalY = this.previewSignature.position.y;
                
                // Place the signature permanently at the preview position
                this.placeSignature(finalX, finalY);
            }
        }
    }
    
    placeSignature(x, y) {
        if (!this.previewSignature.file) return;
        
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
        
        // Add to placed signatures
        this.placedSignatures[this.currentPage].push(signatureData);
        
        // Re-render placed signatures
        this.renderPlacedSignatures();
        
        // Update placed signatures info
        this.updatePlacedSignaturesInfo();
        
        // Hide preview after placing
        this.hideSignaturePreview();
        
        // Clear active selection in library
        document.querySelectorAll('.signature-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.previewSignature.file = null;
        
        // Optional: Log placement for debugging
        if (window.DEBUG_SIGNATURES) {
            console.log(`Signature placed at canvas coordinates: (${x}, ${y}), size: ${this.previewSignature.size}`);
        }
    }
    
    // Utility method to ensure accurate coordinate conversion
    getCanvasToContainerOffset() {
        const canvas = document.getElementById('pdfCanvas');
        const container = document.querySelector('.pdf-container');
        
        if (!canvas || !container) return { x: 0, y: 0 };
        
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        return {
            x: canvasRect.left - containerRect.left,
            y: canvasRect.top - containerRect.top
        };
    }
    
    // Utility method to validate signature position bounds
    validateSignaturePosition(position, size, canvasRect) {
        return {
            x: Math.max(0, Math.min(position.x, canvasRect.width - size)),
            y: Math.max(0, Math.min(position.y, canvasRect.height - (size * 0.5)))
        };
    }
    
    renderPlacedSignatures() {
        const placedContainer = document.getElementById('placedSignatures');
        placedContainer.innerHTML = '';
        
        // Render signatures for current page
        const pageSignatures = this.placedSignatures[this.currentPage] || [];
        
        pageSignatures.forEach(signature => {
            const signatureElement = this.createPlacedSignatureElement(signature);
            placedContainer.appendChild(signatureElement);
        });
    }
    
    createPlacedSignatureElement(signatureData) {
        const signatureEl = document.createElement('div');
        signatureEl.className = 'placed-signature';
        signatureEl.dataset.signatureId = signatureData.id;
        
        // Position exactly where it was placed
        signatureEl.style.position = 'absolute';
        signatureEl.style.left = `${signatureData.position.x}px`;
        signatureEl.style.top = `${signatureData.position.y}px`;
        signatureEl.style.width = `${signatureData.size}px`;
        signatureEl.style.height = `${signatureData.size * 0.5}px`;
        signatureEl.style.opacity = signatureData.opacity;
        signatureEl.style.zIndex = '5';
        
        // Image with precise fit
        const img = document.createElement('img');
        img.src = URL.createObjectURL(signatureData.file);
        img.alt = 'Placed signature';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none'; // Allow click-through to signature element
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-signature';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove signature';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.removePlacedSignature(signatureData.id);
        };
        
        signatureEl.appendChild(img);
        signatureEl.appendChild(removeBtn);
        
        return signatureEl;
    }
    
    removePlacedSignature(signatureId) {
        // Find and remove signature from all pages
        Object.keys(this.placedSignatures).forEach(page => {
            this.placedSignatures[page] = this.placedSignatures[page].filter(
                sig => sig.id !== signatureId
            );
        });
        
        // Re-render signatures
        this.renderPlacedSignatures();
        this.updatePlacedSignaturesInfo();
    }
    
    updatePlacedSignaturesInfo() {
        const placedInfo = document.getElementById('placedSignaturesInfo');
        const placedList = document.getElementById('placedSignaturesList');
        
        // Count total placed signatures
        let totalSignatures = 0;
        Object.keys(this.placedSignatures).forEach(page => {
            totalSignatures += this.placedSignatures[page].length;
        });
        
        if (totalSignatures === 0) {
            placedInfo.style.display = 'none';
            return;
        }
        
        placedInfo.style.display = 'block';
        placedList.innerHTML = '';
        
        // Show signatures by page
        Object.keys(this.placedSignatures).forEach(page => {
            const pageSignatures = this.placedSignatures[page];
            if (pageSignatures.length > 0) {
                const pageInfo = document.createElement('div');
                pageInfo.className = 'placed-signature-item';
                pageInfo.textContent = `Page ${parseInt(page) + 1}: ${pageSignatures.length} signature(s)`;
                placedList.appendChild(pageInfo);
            }
        });
    }
    
    clearAllSignatures() {
        this.placedSignatures = {};
        this.renderPlacedSignatures();
        this.updatePlacedSignaturesInfo();
        this.hideSignaturePreview();
        this.previewSignature.file = null;
        
        // Clear active selection
        document.querySelectorAll('.signature-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    async downloadSignedPDF() {
        if (!this.pdfDoc) {
            this.showError('Please upload a PDF file.');
            return;
        }
        
        // Check if any signatures are placed
        let hasSignatures = false;
        Object.keys(this.placedSignatures).forEach(page => {
            if (this.placedSignatures[page].length > 0) {
                hasSignatures = true;
            }
        });
        
        if (!hasSignatures) {
            this.showError('Please place at least one signature on the PDF.');
            return;
        }

        try {
            const downloadBtn = document.getElementById('downloadBtn');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<div class="loading"></div> Processing...';
            downloadBtn.disabled = true;

            // Get pages from PDF
            const pages = this.pdfDoc.getPages();
            
            // Process each page with placed signatures
            for (const pageIndex of Object.keys(this.placedSignatures)) {
                const pageSignatures = this.placedSignatures[pageIndex];
                if (pageSignatures.length === 0) continue;
                
                const page = pages[parseInt(pageIndex)];
                const { width, height } = page.getSize();
                
                // Get canvas dimensions for coordinate conversion
                const canvas = document.getElementById('pdfCanvas');
                const canvasDisplayWidth = parseFloat(canvas.style.width) || canvas.width;
                const canvasDisplayHeight = parseFloat(canvas.style.height) || canvas.height;
                
                // Calculate scale factors
                const scaleX = width / canvasDisplayWidth;
                const scaleY = height / canvasDisplayHeight;
                
                // Add each signature on this page
                for (const signature of pageSignatures) {
                    // Load and embed signature image
                    const signatureImageBytes = await signature.file.arrayBuffer();
                    let signatureImage;
                    
                    if (signature.file.type === 'image/png') {
                        signatureImage = await this.pdfDoc.embedPng(signatureImageBytes);
                    } else {
                        signatureImage = await this.pdfDoc.embedJpg(signatureImageBytes);
                    }
                    
                    // Precise coordinate conversion from canvas to PDF coordinates
                    // Canvas coordinates: (0,0) at top-left, Y increases downward
                    // PDF coordinates: (0,0) at bottom-left, Y increases upward
                    
                    const canvasX = signature.position.x;
                    const canvasY = signature.position.y; 
                    const sigWidth = signature.size;
                    const sigHeight = signature.size * 0.5;
                    
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
                }
            }

            // Generate PDF
            const pdfBytes = await this.pdfDoc.save();

            // Download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `signed_${this.pdfFile.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Reset button
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;

            this.showSuccess('PDF downloaded successfully! 🎉');

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.showError('Failed to generate signed PDF. Please try again.');
            
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.innerHTML = '💾 Download Signed PDF';
            downloadBtn.disabled = false;
        }
    }

    reset() {
        this.pdfFile = null;
        this.signatureFiles = [];
        this.pdfDoc = null;
        this.pdfJsDoc = null;
        this.currentPage = 0;
        this.placedSignatures = {};
        this.previewSignature = { file: null, position: { x: 100, y: 100 }, size: 150, opacity: 1 };
        this.canvasScale = 1;
        this.outputScale = 1;
        this.activeSignatureIndex = 0;

        // Reset upload areas
        document.getElementById('pdfUpload').classList.remove('uploaded');
        document.getElementById('signatureUpload').classList.remove('uploaded');
        
        const pdfContent = document.querySelector('#pdfUpload .upload-content');
        pdfContent.innerHTML = `
            <div class="upload-icon">📄</div>
            <h3>Upload PDF Document</h3>
            <p>Drop your PDF here or click to browse</p>
        `;
        
        const signatureContent = document.querySelector('#signatureUpload .upload-content');
        signatureContent.innerHTML = `
            <div class="upload-icon">✍️</div>
            <h4>Add New Signature/Image</h4>
            <p>Drop PNG/JPG files here or click to browse</p>
        `;

        // Reset inputs
        document.getElementById('pdfInput').value = '';
        document.getElementById('signatureInput').value = '';
        document.getElementById('signatureSize').value = 150;
        document.getElementById('signatureOpacity').value = 1;
        document.getElementById('sizeValue').textContent = '150px';
        document.getElementById('opacityValue').textContent = '100%';

        // Clear signature library and placed signatures
        document.getElementById('signaturesList').style.display = 'none';
        document.getElementById('signaturesGrid').innerHTML = '';
        document.getElementById('placedSignaturesInfo').style.display = 'none';
        document.getElementById('placedSignatures').innerHTML = '';
        
        // Hide preview section
        document.getElementById('previewSection').style.display = 'none';
        
        // Hide signature preview
        this.hideSignaturePreview();

        this.showSuccess('Reset complete! Ready for new signatures and PDFs. ✨');
    }

    showError(message) {
        // Simple alert for now - could be enhanced with a toast notification
        alert('❌ ' + message);
    }

    showSuccess(message) {
        // Simple alert for now - could be enhanced with a toast notification
        alert('✅ ' + message);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PDFSignOMatic();
});

// Add some drag and drop visual feedback
document.addEventListener('dragenter', (e) => {
    e.preventDefault();
});

document.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('upload-area')) {
        e.target.classList.remove('dragover');
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    if (!e.target.closest('.upload-area')) {
        e.preventDefault();
    }
});
