// Script para el editor de recorte con rectángulo ajustable

let imageDataUrl = null;
let cropBox = null;
let overlay = null;
let sourceImage = null;
let imageContainer = null;
let isDragging = false;
let isResizing = false;
let dragStart = { x: 0, y: 0 };
let cropStart = { x: 0, y: 0, width: 0, height: 0 };
let resizeHandle = null;
let sizeInfo = null;

// Inicializar
function init() {
    cropBox = document.getElementById('cropBox');
    overlay = document.getElementById('overlay');
    sourceImage = document.getElementById('sourceImage');
    imageContainer = document.getElementById('imageContainer');
    sizeInfo = document.getElementById('sizeInfo');
    
    // Cargar la imagen
    loadImage();
    
    // Event listeners
    setupEventListeners();
}

function loadImage() {
    const urlParams = new URLSearchParams(window.location.search);
    const imageId = urlParams.get('id');
    
    if (imageId) {
        chrome.storage.local.get(['capture_' + imageId], (result) => {
            const storedData = result['capture_' + imageId];
            if (storedData && storedData.dataUrl) {
                imageDataUrl = storedData.dataUrl;
                sourceImage.src = storedData.dataUrl;
            } else {
                chrome.storage.local.get(['lastCapture'], (result) => {
                    if (result.lastCapture) {
                        imageDataUrl = result.lastCapture;
                        sourceImage.src = result.lastCapture;
                    } else {
                        alert('No se encontró ninguna imagen');
                        window.close();
                    }
                });
            }
        });
    } else {
        chrome.storage.local.get(['lastCapture'], (result) => {
            if (result.lastCapture) {
                imageDataUrl = result.lastCapture;
                sourceImage.src = result.lastCapture;
            } else {
                alert('No se encontró ninguna imagen');
                window.close();
            }
        });
    }
    
    sourceImage.onload = () => {
        // Esperar un momento para que el layout se estabilice
        setTimeout(() => {
            const imgRect = sourceImage.getBoundingClientRect();
            
            // Ajustar el overlay al tamaño de la imagen
            overlay.style.width = imgRect.width + 'px';
            overlay.style.height = imgRect.height + 'px';
            
            // Inicializar el rectángulo de recorte en el centro (60% del tamaño)
            const initialSize = Math.min(imgRect.width, imgRect.height) * 0.6;
            const initialX = (imgRect.width - initialSize) / 2;
            const initialY = (imgRect.height - initialSize) / 2;
            
            setCropBox(initialX, initialY, initialSize, initialSize);
            updateSizeInfo();
        }, 100);
    };
}

function setCropBox(x, y, width, height) {
    const imgRect = sourceImage.getBoundingClientRect();
    
    // Asegurar que el rectángulo esté dentro de los límites
    x = Math.max(0, Math.min(x, imgRect.width - width));
    y = Math.max(0, Math.min(y, imgRect.height - height));
    width = Math.max(50, Math.min(width, imgRect.width - x));
    height = Math.max(50, Math.min(height, imgRect.height - y));
    
    cropBox.style.left = x + 'px';
    cropBox.style.top = y + 'px';
    cropBox.style.width = width + 'px';
    cropBox.style.height = height + 'px';
    
    updateOverlay();
    updateSizeInfo();
}

function updateOverlay() {
    const boxRect = cropBox.getBoundingClientRect();
    const imgRect = sourceImage.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();
    
    const imgLeft = imgRect.left - containerRect.left;
    const imgTop = imgRect.top - containerRect.top;
    const imgWidth = imgRect.width;
    const imgHeight = imgRect.height;
    
    const boxLeft = boxRect.left - containerRect.left;
    const boxTop = boxRect.top - containerRect.top;
    const boxWidth = boxRect.width;
    const boxHeight = boxRect.height;
    
    // Overlay superior
    const overlayTop = document.getElementById('overlayTop');
    overlayTop.style.left = imgLeft + 'px';
    overlayTop.style.top = imgTop + 'px';
    overlayTop.style.width = imgWidth + 'px';
    overlayTop.style.height = Math.max(0, boxTop - imgTop) + 'px';
    
    // Overlay inferior
    const overlayBottom = document.getElementById('overlayBottom');
    overlayBottom.style.left = imgLeft + 'px';
    overlayBottom.style.top = (boxTop + boxHeight) + 'px';
    overlayBottom.style.width = imgWidth + 'px';
    overlayBottom.style.height = Math.max(0, (imgTop + imgHeight) - (boxTop + boxHeight)) + 'px';
    
    // Overlay izquierdo
    const overlayLeft = document.getElementById('overlayLeft');
    overlayLeft.style.left = imgLeft + 'px';
    overlayLeft.style.top = boxTop + 'px';
    overlayLeft.style.width = Math.max(0, boxLeft - imgLeft) + 'px';
    overlayLeft.style.height = boxHeight + 'px';
    
    // Overlay derecho
    const overlayRight = document.getElementById('overlayRight');
    overlayRight.style.left = (boxLeft + boxWidth) + 'px';
    overlayRight.style.top = boxTop + 'px';
    overlayRight.style.width = Math.max(0, (imgLeft + imgWidth) - (boxLeft + boxWidth)) + 'px';
    overlayRight.style.height = boxHeight + 'px';
}

function updateSizeInfo() {
    const width = parseInt(cropBox.style.width) || 0;
    const height = parseInt(cropBox.style.height) || 0;
    sizeInfo.textContent = `${width} x ${height} px`;
}

function setupEventListeners() {
    // Redimensionar desde las esquinas y bordes - PRIMERO para que tenga prioridad
    const handles = cropBox.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            isDragging = false; // Asegurar que no se active el arrastre
            resizeHandle = handle;
            const boxRect = cropBox.getBoundingClientRect();
            const containerRect = imageContainer.getBoundingClientRect();
            const imgRect = sourceImage.getBoundingClientRect();
            
            // Calcular coordenadas relativas a la imagen (no al contenedor)
            const imgLeft = imgRect.left;
            const imgTop = imgRect.top;
            cropStart.x = boxRect.left - imgLeft;
            cropStart.y = boxRect.top - imgTop;
            cropStart.width = boxRect.width;
            cropStart.height = boxRect.height;
            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Detener cualquier otro listener
        });
    });
    
    // Mover el rectángulo - SOLO si NO es un handle
    cropBox.addEventListener('mousedown', (e) => {
        // Verificar que NO sea un handle ni un hijo de handle
        if (e.target.classList.contains('crop-handle') || 
            e.target.closest('.crop-handle')) {
            return; // No hacer nada si es un handle
        }
        
        // Solo activar arrastre si es el cropBox mismo o su fondo
        if (e.target === cropBox || e.target.classList.contains('crop-box')) {
            isDragging = true;
            isResizing = false; // Asegurar que no se active el redimensionamiento
            const boxRect = cropBox.getBoundingClientRect();
            const containerRect = imageContainer.getBoundingClientRect();
            dragStart.x = e.clientX - (boxRect.left - containerRect.left);
            dragStart.y = e.clientY - (boxRect.top - containerRect.top);
            e.preventDefault();
        }
    });
    
    // Mouse move global
    document.addEventListener('mousemove', (e) => {
        if (isDragging && !isResizing) {
            const containerRect = imageContainer.getBoundingClientRect();
            const imgRect = sourceImage.getBoundingClientRect();
            let newX = e.clientX - containerRect.left - dragStart.x;
            let newY = e.clientY - containerRect.top - dragStart.y;
            
            // Mantener dentro de los límites
            newX = Math.max(0, Math.min(newX, imgRect.width - cropBox.offsetWidth));
            newY = Math.max(0, Math.min(newY, imgRect.height - cropBox.offsetHeight));
            
            cropBox.style.left = newX + 'px';
            cropBox.style.top = newY + 'px';
            updateOverlay();
            updateSizeInfo();
        } else if (isResizing && resizeHandle) {
            const containerRect = imageContainer.getBoundingClientRect();
            const imgRect = sourceImage.getBoundingClientRect();
            
            // Calcular posición del mouse relativa a la imagen de forma más precisa
            const imgLeft = imgRect.left;
            const imgTop = imgRect.top;
            
            // Calcular mouseX y mouseY directamente desde las coordenadas del evento
            let mouseX = e.clientX - imgLeft;
            let mouseY = e.clientY - imgTop;
            
            // Asegurar que las coordenadas estén dentro de los límites de la imagen
            mouseX = Math.max(0, Math.min(mouseX, imgRect.width));
            mouseY = Math.max(0, Math.min(mouseY, imgRect.height));
            
            // Asegurar que las coordenadas de inicio sean relativas a la imagen
            const imgWidth = imgRect.width;
            const imgHeight = imgRect.height;
            
            const handleEndX = cropStart.x + cropStart.width;
            const handleEndY = cropStart.y + cropStart.height;
            
            let newX = cropStart.x;
            let newY = cropStart.y;
            let newWidth = cropStart.width;
            let newHeight = cropStart.height;
            
            const handleClass = resizeHandle.className;
            
            // Esquinas
            if (handleClass.includes('nw')) {
                // Esquina superior izquierda
                newX = Math.max(0, Math.min(mouseX, handleEndX - 50));
                newY = Math.max(0, Math.min(mouseY, handleEndY - 50));
                newWidth = handleEndX - newX;
                newHeight = handleEndY - newY;
            } else if (handleClass.includes('ne')) {
                // Esquina superior derecha
                newX = cropStart.x;
                newY = Math.max(0, Math.min(mouseY, handleEndY - 50));
                newWidth = Math.max(50, Math.min(mouseX - newX, imgWidth - newX));
                newHeight = handleEndY - newY;
            } else if (handleClass.includes('sw')) {
                // Esquina inferior izquierda
                newX = Math.max(0, Math.min(mouseX, handleEndX - 50));
                newY = cropStart.y;
                newWidth = handleEndX - newX;
                newHeight = Math.max(50, Math.min(mouseY - newY, imgHeight - newY));
            } else if (handleClass.includes('se')) {
                // Esquina inferior derecha
                newX = cropStart.x;
                newY = cropStart.y;
                newWidth = Math.max(50, Math.min(mouseX - newX, imgWidth - newX));
                newHeight = Math.max(50, Math.min(mouseY - newY, imgHeight - newY));
            }
            
            // Validaciones unificadas - aplicar a todas las esquinas
            // 1. Mantener dentro de los límites de la imagen
            if (newX < 0) {
                if (handleClass.includes('nw') || handleClass.includes('sw')) {
                    newWidth += newX;
                }
                newX = 0;
            }
            if (newY < 0) {
                if (handleClass.includes('nw') || handleClass.includes('ne')) {
                    newHeight += newY;
                }
                newY = 0;
            }
            if (newX + newWidth > imgWidth) {
                newWidth = imgWidth - newX;
            }
            if (newY + newHeight > imgHeight) {
                newHeight = imgHeight - newY;
            }
            
            // 2. Asegurar tamaño mínimo
            if (newWidth < 50) {
                if (handleClass.includes('nw') || handleClass.includes('sw')) {
                    newX = (newX + newWidth) - 50;
                    if (newX < 0) newX = 0;
                }
                newWidth = 50;
            }
            if (newHeight < 50) {
                if (handleClass.includes('nw') || handleClass.includes('ne')) {
                    newY = (newY + newHeight) - 50;
                    if (newY < 0) newY = 0;
                }
                newHeight = 50;
            }
            
            // 3. Verificar límites finales después del ajuste de tamaño mínimo
            if (newX + newWidth > imgWidth) {
                newWidth = imgWidth - newX;
            }
            if (newY + newHeight > imgHeight) {
                newHeight = imgHeight - newY;
            }
            
            setCropBox(newX, newY, newWidth, newHeight);
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        resizeHandle = null;
    });
    
    // Botones
    document.getElementById('cropBtn').addEventListener('click', performCrop);
    document.getElementById('cancelBtn').addEventListener('click', () => window.close());
    
    // ESC para cancelar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.close();
        }
    });
}

function performCrop() {
    if (!imageDataUrl) {
        alert('No hay imagen para recortar');
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        const boxRect = cropBox.getBoundingClientRect();
        const imgRect = sourceImage.getBoundingClientRect();
        const containerRect = imageContainer.getBoundingClientRect();
        
        // Calcular las coordenadas relativas a la imagen original
        const scaleX = img.width / imgRect.width;
        const scaleY = img.height / imgRect.height;
        
        const cropX = (boxRect.left - containerRect.left - (imgRect.left - containerRect.left)) * scaleX;
        const cropY = (boxRect.top - containerRect.top - (imgRect.top - containerRect.top)) * scaleY;
        const cropWidth = boxRect.width * scaleX;
        const cropHeight = boxRect.height * scaleY;
        
        // Crear canvas para recortar con máxima calidad
        const canvas = document.createElement('canvas');
        // Usar la resolución completa de la imagen original para máxima calidad
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d');
        
        // Configurar renderizado de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Dibujar la porción recortada
        ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );
        
        // Convertir a data URL con máxima calidad (PNG sin compresión)
        const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
        
        // Guardar y abrir en nueva pestaña
        const captureId = Date.now().toString();
        chrome.storage.local.set({
            ['capture_' + captureId]: {
                dataUrl: croppedDataUrl,
                timestamp: Date.now()
            },
            lastCapture: croppedDataUrl
        }, () => {
            const viewerUrl = chrome.runtime.getURL('viewer.html') + '?id=' + captureId;
            chrome.tabs.create({ url: viewerUrl });
            window.close();
        });
    };
    img.src = imageDataUrl;
}

// Inicializar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', init);

