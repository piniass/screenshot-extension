let currentCanvas = null;
let currentDataUrl = null; // Guardar el dataUrl actual para descarga directa

document.getElementById('captureVisible').addEventListener('click', () => {
    captureVisible();
});

document.getElementById('captureArea').addEventListener('click', () => {
    captureArea();
});

document.getElementById('cropImage').addEventListener('click', () => {
    openCropEditor();
});

document.getElementById('downloadBtn').addEventListener('click', downloadCapture);
document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
document.getElementById('newCaptureBtn').addEventListener('click', resetCapture);

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Capturar lo que está visible actualmente
function captureVisible() {
    showStatus('Capturando vista actual...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            showStatus('No se encontró pestaña activa', 'error');
            return;
        }
        
        chrome.tabs.captureVisibleTab(null, { 
            format: 'png',
            quality: 100 
        }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (dataUrl) {
                displayCapture(dataUrl);
                showStatus('Captura realizada exitosamente', 'success');
            } else {
                showStatus('Error al capturar la vista', 'error');
            }
        });
    });
}

// Capturar área seleccionada por el usuario
function captureArea() {
    showStatus('Preparando selección de área...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            showStatus('No se encontró pestaña activa', 'error');
            return;
        }
        
        const tabId = tabs[0].id;
        const tabUrl = tabs[0].url;
        
        // Verificar que la URL permita inyección de scripts
        if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
            showStatus('Esta página no permite capturas. Abre una página web normal.', 'error');
            return;
        }
        
        // Inyectar el script de selección de área
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['selector.js']
        }, (results) => {
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                showStatus('Error: ' + errorMsg, 'error');
                console.error('Error al inyectar script:', errorMsg);
                return;
            }
            
            if (!results || results.length === 0) {
                showStatus('Error: No se pudo inyectar el script', 'error');
                return;
            }
            
            // Intentar enviar el mensaje con reintentos
            let attempts = 0;
            const maxAttempts = 5;
            
            function trySendMessage() {
                attempts++;
                
                chrome.tabs.sendMessage(tabId, { action: 'startAreaSelection' }, (response) => {
                    if (chrome.runtime.lastError) {
                        if (attempts < maxAttempts) {
                            // Reintentar después de un breve delay
                            setTimeout(trySendMessage, 200);
                        } else {
                            const errorMsg = chrome.runtime.lastError.message;
                            showStatus('Error: ' + errorMsg + '. Intenta recargar la página.', 'error');
                            console.error('Error al enviar mensaje después de', attempts, 'intentos:', errorMsg);
                        }
                        return;
                    }
                    
                    // Si todo está bien, cerrar el popup para que el usuario pueda ver la página
                    if (response && response.success) {
                        setTimeout(() => {
                            window.close();
                        }, 100);
                    } else {
                        if (attempts < maxAttempts) {
                            setTimeout(trySendMessage, 200);
                        } else {
                            showStatus('Error al iniciar la selección', 'error');
                        }
                    }
                });
            }
            
            // Esperar un momento para que el script se cargue completamente
            setTimeout(trySendMessage, 300);
        });
    });
}

function displayCapture(dataUrl) {
    currentDataUrl = dataUrl; // Guardar el dataUrl
    
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Configurar renderizado de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0);
        currentCanvas = canvas;
        document.getElementById('preview').style.display = 'block';
    };
    
    img.onerror = () => {
        showStatus('Error al cargar la imagen', 'error');
    };
    
    img.src = dataUrl;
}

function downloadCapture() {
    if (!currentDataUrl && !currentCanvas) {
        showStatus('No hay captura para descargar', 'error');
        return;
    }
    
    // Función para convertir dataUrl a blob y descargar
    function downloadFromDataUrl(dataUrl, filename) {
        // Convertir dataUrl a blob
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                // Usar la API de descargas de Chrome
                const url = URL.createObjectURL(blob);
                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        // Si falla la API de Chrome, intentar método alternativo
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    } else {
                        // La descarga se inició correctamente
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                    showStatus('Imagen descargada exitosamente', 'success');
                });
            })
            .catch(error => {
                console.error('Error al descargar:', error);
                showStatus('Error al descargar: ' + error.message, 'error');
            });
    }
    
    try {
        const filename = `captura-${Date.now()}.png`;
        
        // Método 1: Si tenemos el dataUrl, usarlo directamente
        if (currentDataUrl) {
            downloadFromDataUrl(currentDataUrl, filename);
            return;
        }
        
        // Método 2: Si solo tenemos el canvas, convertir a dataUrl primero
        if (currentCanvas) {
            const dataUrl = currentCanvas.toDataURL('image/png', 1.0);
            downloadFromDataUrl(dataUrl, filename);
        }
    } catch (error) {
        console.error('Error al descargar:', error);
        showStatus('Error al descargar: ' + error.message, 'error');
    }
}

async function copyToClipboard() {
    if (!currentCanvas) {
        showStatus('No hay captura para copiar', 'error');
        return;
    }
    
    try {
        currentCanvas.toBlob(async (blob) => {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showStatus('Imagen copiada al portapapeles', 'success');
        }, 'image/png', 1.0);
    } catch (error) {
        console.error('Error al copiar:', error);
        showStatus('Error al copiar: ' + error.message, 'error');
    }
}

function resetCapture() {
    document.getElementById('preview').style.display = 'none';
    currentCanvas = null;
    currentDataUrl = null;
}

// Abrir editor de recorte con rectángulo ajustable
function openCropEditor() {
    // Siempre capturar la pantalla actual del navegador
    showStatus('Capturando pantalla actual para recortar...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            showStatus('No se encontró pestaña activa', 'error');
            return;
        }
        
        const tabUrl = tabs[0].url;
        
        // Verificar que la URL permita capturas
        if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || 
            tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
            showStatus('Esta página no permite capturas. Abre una página web normal.', 'error');
            return;
        }
        
        chrome.tabs.captureVisibleTab(null, { 
            format: 'png',
            quality: 100 
        }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (dataUrl) {
                // Generar un ID único para esta captura
                const captureId = Date.now().toString();
                
                // Guardar la nueva captura (sin sobrescribir lastCapture para otras funcionalidades)
                chrome.storage.local.set({
                    ['capture_' + captureId]: {
                        dataUrl: dataUrl,
                        timestamp: Date.now()
                    }
                }, () => {
                    // Abrir el editor de recorte con la nueva captura
                    const cropUrl = chrome.runtime.getURL('crop.html') + '?id=' + captureId;
                    chrome.tabs.create({ url: cropUrl });
                });
            } else {
                showStatus('Error al capturar la pantalla', 'error');
            }
        });
    });
}

// Verificar si hay una captura guardada al cargar el popup
window.addEventListener('DOMContentLoaded', () => {
    checkForSavedCapture();
});

function checkForSavedCapture() {
    chrome.storage.local.get(['lastCapture', 'captureTimestamp'], (result) => {
        if (result.lastCapture) {
            // Verificar que la captura no sea muy antigua (menos de 30 segundos)
            const age = Date.now() - (result.captureTimestamp || 0);
            if (age < 30000) {
                displayCapture(result.lastCapture);
                showStatus('Área capturada exitosamente', 'success');
                // Limpiar la captura guardada
                chrome.storage.local.remove(['lastCapture', 'captureTimestamp']);
            }
        }
    });
}

// Escuchar mensajes desde el background script para capturas de área
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'areaCaptureComplete') {
        displayCapture(request.dataUrl);
        showStatus('Área capturada exitosamente', 'success');
        // Limpiar cualquier captura guardada anterior
        chrome.storage.local.remove(['lastCapture', 'captureTimestamp']);
    } else if (request.action === 'areaCaptureError') {
        showStatus('Error: ' + (request.error || 'Error desconocido'), 'error');
    } else if (request.action === 'areaSelectionCancelled') {
        // El usuario canceló, no hacer nada
    }
    return true;
});
