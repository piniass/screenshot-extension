// Script para seleccionar un área de la página y capturarla

let isSelecting = false;
let startX = 0;
let startY = 0;
let selectionBox = null;
let overlay = null;
let isInitialized = false;

// Función para iniciar la selección
function startSelectionMode() {
    // Limpiar cualquier selección anterior si existe
    if (isInitialized) {
        cleanup();
    }
    initAreaSelector();
}

// Registrar el listener inmediatamente cuando el script se carga
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAreaSelection') {
        startSelectionMode();
        sendResponse({ success: true });
    } else if (request.action === 'cropImage') {
        // Recortar la imagen según las coordenadas del viewport
        cropImage(request.dataUrl, request.viewportX, request.viewportY, request.width, request.height)
            .then((croppedDataUrl) => {
                sendResponse({ success: true, croppedDataUrl: croppedDataUrl });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Mantener el canal abierto para respuesta asíncrona
    }
    return true;
});

// Auto-inicializar si el script se ejecuta directamente (para debugging)
// Esto ayuda a verificar que el script se está cargando
console.log('Selector de área cargado y listo');

function initAreaSelector() {
    // Limpiar cualquier elemento anterior si existe
    const existingOverlay = document.getElementById('screenshot-overlay');
    const existingSelection = document.getElementById('screenshot-selection');
    const existingInstructions = document.getElementById('screenshot-instructions');
    
    if (existingOverlay) existingOverlay.remove();
    if (existingSelection) existingSelection.remove();
    if (existingInstructions) existingInstructions.remove();
    
    // Crear overlay que cubre toda la página
    overlay = document.createElement('div');
    overlay.id = 'screenshot-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        z-index: 999999;
        cursor: crosshair;
        user-select: none;
        margin: 0;
        padding: 0;
    `;
    
    // Crear caja de selección
    selectionBox = document.createElement('div');
    selectionBox.id = 'screenshot-selection';
    selectionBox.style.cssText = `
        position: fixed;
        border: 2px dashed #4CAF50;
        background: rgba(76, 175, 80, 0.15);
        pointer-events: none;
        z-index: 1000000;
        display: none;
        box-sizing: border-box;
    `;
    
    // Crear instrucciones
    const instructions = document.createElement('div');
    instructions.id = 'screenshot-instructions';
    instructions.textContent = 'Arrastra para seleccionar el área a capturar. Presiona ESC para cancelar.';
    instructions.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 1000001;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 14px;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(selectionBox);
    document.body.appendChild(instructions);
    
    // Event listeners
    overlay.addEventListener('mousedown', startSelection, true);
    document.addEventListener('mousemove', updateSelection, true);
    document.addEventListener('mouseup', endSelection, true);
    document.addEventListener('keydown', handleKeyPress, true);
    
    // Prevenir scroll durante la selección
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    isInitialized = true;
    
    // Guardar el overflow original para restaurarlo después
    overlay.dataset.originalOverflow = originalOverflow;
}

function startSelection(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    
    e.preventDefault();
    e.stopPropagation();
}

function updateSelection(e) {
    if (!isSelecting) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    e.preventDefault();
    e.stopPropagation();
}

function endSelection(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    
    const rect = selectionBox.getBoundingClientRect();
    
    // Verificar que el área seleccionada sea válida (al menos 10x10 píxeles)
    if (rect.width < 10 || rect.height < 10) {
        cancelSelection();
        return;
    }
    
    // Capturar el área seleccionada
    captureSelectedArea(rect);
    
    e.preventDefault();
    e.stopPropagation();
}

function handleKeyPress(e) {
    if (e.key === 'Escape') {
        cancelSelection();
    }
}

function cancelSelection() {
    cleanup();
    chrome.runtime.sendMessage({
        action: 'areaSelectionCancelled'
    });
}

function captureSelectedArea(rect) {
    // Obtener la posición del scroll
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Las coordenadas del rect son relativas al viewport
    // Necesitamos las coordenadas absolutas para la página completa
    const absoluteX = rect.left + scrollX;
    const absoluteY = rect.top + scrollY;
    const width = rect.width;
    const height = rect.height;
    
    // Guardar las coordenadas relativas al viewport para el recorte
    const viewportX = rect.left;
    const viewportY = rect.top;
    
    // Limpiar la UI
    cleanup();
    
    // Mostrar indicador de carga
    console.log('Capturando área seleccionada:', { viewportX, viewportY, width, height });
    
    // Enviar mensaje al background para capturar
    chrome.runtime.sendMessage({
        action: 'captureSelectedArea',
        viewportX: viewportX,
        viewportY: viewportY,
        width: width,
        height: height,
        scrollX: scrollX,
        scrollY: scrollY
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error al capturar:', chrome.runtime.lastError.message);
            chrome.runtime.sendMessage({
                action: 'areaCaptureError',
                error: chrome.runtime.lastError.message
            });
            return;
        }
        
        if (response && response.success && response.dataUrl) {
            console.log('Captura exitosa, abriendo en nueva pestaña...');
            // Enviar la captura al background para guardarla y abrirla
            chrome.runtime.sendMessage({
                action: 'areaCaptureComplete',
                dataUrl: response.dataUrl
            });
        } else {
            const errorMsg = response ? response.error : 'Error desconocido al capturar';
            console.error('Error en la respuesta:', errorMsg);
            chrome.runtime.sendMessage({
                action: 'areaCaptureError',
                error: errorMsg
            });
        }
    });
}

function cleanup() {
    isSelecting = false;
    
    if (overlay && overlay.parentNode) {
        const originalOverflow = overlay.dataset.originalOverflow || '';
        document.body.style.overflow = originalOverflow;
        overlay.parentNode.removeChild(overlay);
    }
    if (selectionBox && selectionBox.parentNode) {
        selectionBox.parentNode.removeChild(selectionBox);
    }
    const instructions = document.getElementById('screenshot-instructions');
    if (instructions && instructions.parentNode) {
        instructions.parentNode.removeChild(instructions);
    }
    
    // Remover event listeners
    document.removeEventListener('mousemove', updateSelection, true);
    document.removeEventListener('mouseup', endSelection, true);
    document.removeEventListener('keydown', handleKeyPress, true);
    
    isInitialized = false;
    overlay = null;
    selectionBox = null;
}

// Función para recortar una imagen
function cropImage(dataUrl, viewportX, viewportY, width, height) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Obtener el factor de escala (devicePixelRatio)
                const scale = window.devicePixelRatio || 1;
                
                console.log('Recortando imagen:', {
                    imageSize: { width: img.width, height: img.height },
                    viewport: { x: viewportX, y: viewportY, width, height },
                    scale: scale
                });
                
                // Crear canvas para la imagen recortada
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Ajustar coordenadas según el factor de escala
                // La captura tiene el tamaño del viewport multiplicado por el scale
                const scaledX = viewportX * scale;
                const scaledY = viewportY * scale;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                
                // Verificar que las coordenadas estén dentro de los límites de la imagen
                if (scaledX < 0 || scaledY < 0 || 
                    scaledX + scaledWidth > img.width || 
                    scaledY + scaledHeight > img.height) {
                    console.warn('Coordenadas fuera de límites, ajustando...');
                    // Ajustar a los límites
                    const adjustedX = Math.max(0, Math.min(scaledX, img.width - scaledWidth));
                    const adjustedY = Math.max(0, Math.min(scaledY, img.height - scaledHeight));
                    const adjustedWidth = Math.min(scaledWidth, img.width - adjustedX);
                    const adjustedHeight = Math.min(scaledHeight, img.height - adjustedY);
                    
                    ctx.drawImage(
                        img,
                        adjustedX, adjustedY, adjustedWidth, adjustedHeight,
                        0, 0, width, height
                    );
                } else {
                    // Dibujar la porción recortada
                    ctx.drawImage(
                        img,
                        scaledX, scaledY, scaledWidth, scaledHeight,  // Source: área a recortar de la imagen completa
                        0, 0, width, height  // Destination: tamaño final del canvas
                    );
                }
                
                // Convertir a data URL
                const croppedDataUrl = canvas.toDataURL('image/png');
                console.log('Recorte completado exitosamente');
                resolve(croppedDataUrl);
            } catch (error) {
                console.error('Error al recortar:', error);
                reject(error);
            }
        };
        img.onerror = (error) => {
            console.error('Error al cargar la imagen:', error);
            reject(new Error('Error al cargar la imagen'));
        };
        img.src = dataUrl;
    });
}


