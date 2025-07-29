

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
            
            // Calculate scale to fit within container
            const maxWidth = 800;
            const maxHeight = 600;
            let scale = Math.min(maxWidth / viewport.width, maxHeight / viewport.height, 1);
            
            // Apply scale to viewport
            const scaledViewport = page.getViewport({ scale });
            
            // Set canvas size
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            this.canvasScale = scale;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Render PDF page
            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
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
        // Fallback placeholder rendering
        canvas.width = 600;
        canvas.height = 800;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#cccccc';
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#666666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`PDF Page ${this.currentPage + 1}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText('(Preview unavailable - actual PDF content will be preserved)', canvas.width / 2, canvas.height / 2 + 30);
        
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
        
        if (!signaturePreview.classList.contains('visible')) return;
        
        const canvasRect = canvas.getBoundingClientRect();
        
        signaturePreview.style.left = `${this.signaturePosition.x}px`;
        signaturePreview.style.top = `${this.signaturePosition.y}px`;
        signaturePreview.style.width = `${this.signatureSize}px`;
        signaturePreview.style.height = `${this.signatureSize * 0.5}px`; // Maintain aspect ratio
        signaturePreview.style.opacity = this.signatureOpacity;
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
        const rect = canvas.getBoundingClientRect();
        
        if (e.target === canvas || e.target.closest('.pdf-container')) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update signature position on hover
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                this.signaturePosition.x = x - this.signatureSize / 2;
                this.signaturePosition.y = y - (this.signatureSize * 0.5) / 2;
                this.updateSignaturePreview();
            }
        }
    }

    handleCanvasClick(e) {
        const canvas = document.getElementById('pdfCanvas');
        const rect = canvas.getBoundingClientRect();
        
        if (e.target === canvas || e.target.closest('.signature-preview')) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                this.signaturePosition.x = x - this.signatureSize / 2;
                this.signaturePosition.y = y - (this.signatureSize * 0.5) / 2;
                this.updateSignaturePreview();
                
                // Add a little animation to show the signature was placed
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
            
            // Convert from canvas coordinates to PDF coordinates
            // Note: PDF coordinates have origin at bottom-left, canvas has origin at top-left
            const pdfX = this.signaturePosition.x / this.canvasScale;
            const pdfY = height - (this.signaturePosition.y + this.signatureSize * 0.5) / this.canvasScale;
            const pdfWidth = this.signatureSize / this.canvasScale;
            const pdfHeight = (this.signatureSize * 0.5) / this.canvasScale;

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
