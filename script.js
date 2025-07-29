

class PDFSignOMatic {
    constructor() {
        this.pdfFile = null;
        this.signatureFile = null;
        this.pdfDoc = null;
        this.pdfJsDoc = null;
        this.currentPage = 0;
        this.signaturePosition = { x: 100, y: 100 };
        this.signatureSize = 150;
        this.signatureOpacity = 1;
        this.canvasScale = 1;
        this.outputScale = 1;
        
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
        signatureInput.addEventListener('change', (e) => this.handleSignatureUpload(e.target.files[0]));

        // Controls
        document.getElementById('pageSelect').addEventListener('change', this.handlePageChange.bind(this));
        document.getElementById('signatureSize').addEventListener('input', this.handleSizeChange.bind(this));
        document.getElementById('signatureOpacity').addEventListener('input', this.handleOpacityChange.bind(this));

        // Action Buttons
        document.getElementById('downloadBtn').addEventListener('click', this.downloadSignedPDF.bind(this));
        document.getElementById('resetBtn').addEventListener('click', this.reset.bind(this));

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
            const file = files[0];
            if (type === 'pdf' && file.type === 'application/pdf') {
                this.handlePDFUpload(file);
            } else if (type === 'signature' && file.type.startsWith('image/')) {
                this.handleSignatureUpload(file);
            } else {
                this.showError(`Please upload a valid ${type === 'pdf' ? 'PDF' : 'image'} file.`);
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

    async handleSignatureUpload(file) {
        if (!file) return;
        
        try {
            this.showLoading('signatureUpload');
            
            this.signatureFile = file;
            this.markUploaded('signatureUpload', '✍️ Signature Loaded!');
            this.checkIfReadyToPreview();
            
        } catch (error) {
            console.error('Error loading signature:', error);
            this.showError('Failed to load signature image.');
            this.resetUploadArea('signatureUpload');
        }
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
    }

    checkIfReadyToPreview() {
        if (this.pdfFile && this.signatureFile) {
            document.getElementById('previewSection').style.display = 'block';
            this.showSignaturePreview();
        }
    }

    async showSignaturePreview() {
        const signaturePreview = document.getElementById('signaturePreview');
        
        // Create image element for signature
        const img = document.createElement('img');
        img.src = URL.createObjectURL(this.signatureFile);
        
        signaturePreview.innerHTML = '';
        signaturePreview.appendChild(img);
        signaturePreview.classList.add('visible');
        
        this.updateSignaturePreview();
    }

    updateSignaturePreview() {
        const signaturePreview = document.getElementById('signaturePreview');
        const canvas = document.getElementById('pdfCanvas');
        const container = document.querySelector('.pdf-container');
        
        if (!signaturePreview.classList.contains('visible')) return;
        
        // Get positions relative to the container
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate offset of canvas within container
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;
        
        // Position signature preview relative to container
        signaturePreview.style.left = `${canvasOffsetX + this.signaturePosition.x}px`;
        signaturePreview.style.top = `${canvasOffsetY + this.signaturePosition.y}px`;
        signaturePreview.style.width = `${this.signatureSize}px`;
        signaturePreview.style.height = `${this.signatureSize * 0.5}px`; // Maintain aspect ratio
        signaturePreview.style.opacity = this.signatureOpacity;
        
        // Ensure the signature preview is visible
        signaturePreview.style.pointerEvents = 'none';
        signaturePreview.style.zIndex = '10';
    }

    handlePageChange(e) {
        this.currentPage = parseInt(e.target.value);
        this.renderPDF();
    }

    handleSizeChange(e) {
        this.signatureSize = parseInt(e.target.value);
        document.getElementById('sizeValue').textContent = `${this.signatureSize}px`;
        this.updateSignaturePreview();
    }

    handleOpacityChange(e) {
        this.signatureOpacity = parseFloat(e.target.value);
        document.getElementById('opacityValue').textContent = `${Math.round(this.signatureOpacity * 100)}%`;
        this.updateSignaturePreview();
    }

    handleMouseMove(e) {
        const canvas = document.getElementById('pdfCanvas');
        const container = document.querySelector('.pdf-container');
        
        if (e.target === canvas || e.target.closest('.pdf-container')) {
            // Get precise canvas positioning
            const rect = canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Calculate mouse position relative to canvas
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check if mouse is within canvas bounds
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                // Center the signature on the mouse position
                this.signaturePosition.x = x - this.signatureSize / 2;
                this.signaturePosition.y = y - (this.signatureSize * 0.5) / 2;
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
        
        if (e.target === canvas || e.target.closest('.signature-preview')) {
            // Get precise click position
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Ensure click is within canvas bounds
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                // Set signature position with precise centering
                this.signaturePosition.x = x - this.signatureSize / 2;
                this.signaturePosition.y = y - (this.signatureSize * 0.5) / 2;
                
                // Ensure signature doesn't go outside canvas bounds
                this.signaturePosition.x = Math.max(0, Math.min(this.signaturePosition.x, rect.width - this.signatureSize));
                this.signaturePosition.y = Math.max(0, Math.min(this.signaturePosition.y, rect.height - (this.signatureSize * 0.5)));
                
                this.updateSignaturePreview();
                
                // Add confirmation animation
                const signaturePreview = document.getElementById('signaturePreview');
                signaturePreview.classList.add('success-animation');
                setTimeout(() => signaturePreview.classList.remove('success-animation'), 600);
            }
        }
    }

    async downloadSignedPDF() {
        if (!this.pdfDoc || !this.signatureFile) {
            this.showError('Please upload both PDF and signature files.');
            return;
        }

        try {
            const downloadBtn = document.getElementById('downloadBtn');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<div class="loading"></div> Processing...';
            downloadBtn.disabled = true;

            // Load signature image
            const signatureImageBytes = await this.signatureFile.arrayBuffer();
            let signatureImage;
            
            if (this.signatureFile.type === 'image/png') {
                signatureImage = await this.pdfDoc.embedPng(signatureImageBytes);
            } else {
                signatureImage = await this.pdfDoc.embedJpg(signatureImageBytes);
            }

            // Get the page
            const pages = this.pdfDoc.getPages();
            const page = pages[this.currentPage];
            const { width, height } = page.getSize();

            // Calculate signature position and size in PDF coordinates
            const canvas = document.getElementById('pdfCanvas');
            
            // Get the display dimensions of the canvas
            const canvasDisplayWidth = parseFloat(canvas.style.width) || canvas.width;
            const canvasDisplayHeight = parseFloat(canvas.style.height) || canvas.height;
            
            // Convert from canvas display coordinates to PDF coordinates
            // Account for the scale factor between display and PDF
            const scaleX = width / canvasDisplayWidth;
            const scaleY = height / canvasDisplayHeight;
            
            // Convert coordinates - PDF has origin at bottom-left, canvas at top-left
            const pdfX = this.signaturePosition.x * scaleX;
            const pdfY = height - (this.signaturePosition.y + this.signatureSize * 0.5) * scaleY;
            const pdfWidth = this.signatureSize * scaleX;
            const pdfHeight = (this.signatureSize * 0.5) * scaleY;

            // Add signature to PDF
            page.drawImage(signatureImage, {
                x: pdfX,
                y: pdfY,
                width: pdfWidth,
                height: pdfHeight,
                opacity: this.signatureOpacity,
            });

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
        this.signatureFile = null;
        this.pdfDoc = null;
        this.pdfJsDoc = null;
        this.currentPage = 0;
        this.signaturePosition = { x: 100, y: 100 };
        this.signatureSize = 150;
        this.signatureOpacity = 1;
        this.canvasScale = 1;
        this.outputScale = 1;

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
            <h3>Upload Signature Image</h3>
            <p>Drop your PNG signature here or click to browse</p>
        `;

        // Reset inputs
        document.getElementById('pdfInput').value = '';
        document.getElementById('signatureInput').value = '';
        document.getElementById('signatureSize').value = 150;
        document.getElementById('signatureOpacity').value = 1;
        document.getElementById('sizeValue').textContent = '150px';
        document.getElementById('opacityValue').textContent = '100%';

        // Hide preview section
        document.getElementById('previewSection').style.display = 'none';

        this.showSuccess('Reset complete! Ready for a new signature. ✨');
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
