// Service Worker para la extensión de captura de pantalla
// Se ejecuta en segundo plano

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extensión de Captura de Pantalla instalada');
});

// Función para limpiar capturas antiguas
function cleanupOldCaptures() {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const keysToRemove = [];
        
        for (const key in items) {
            if (key.startsWith('capture_')) {
                const data = items[key];
                if (data.timestamp && (now - data.timestamp) > oneHour) {
                    keysToRemove.push(key);
                }
            }
        }
        
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
        }
    });
}

// Escuchar mensajes desde el content script para capturar secciones visibles
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureVisibleSection') {
        // Capturar la pestaña visible actual
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.captureVisibleTab(null, { 
                    format: 'png',
                    quality: 100 
                }, (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ success: true, dataUrl: dataUrl });
                    }
                });
            } else {
                sendResponse({ success: false, error: 'No se encontró pestaña activa' });
            }
        });
        return true; // Mantener el canal abierto para respuesta asíncrona
    }
    
    if (request.action === 'captureSelectedArea') {
        // Capturar la pestaña y enviar los datos al content script para recortar
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.captureVisibleTab(null, { 
                    format: 'png',
                    quality: 100 
                }, (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        // Enviar la captura completa y las coordenadas al content script para recortar
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'cropImage',
                            dataUrl: dataUrl,
                            viewportX: request.viewportX,
                            viewportY: request.viewportY,
                            width: request.width,
                            height: request.height
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                            } else if (response && response.success) {
                                sendResponse({ success: true, dataUrl: response.croppedDataUrl });
                            } else {
                                sendResponse({ success: false, error: 'Error al recortar la imagen' });
                            }
                        });
                    }
                });
            } else {
                sendResponse({ success: false, error: 'No se encontró pestaña activa' });
            }
        });
        return true; // Mantener el canal abierto para respuesta asíncrona
    }
    
    // Guardar captura y abrir en nueva pestaña
    if (request.action === 'areaCaptureComplete') {
        // Generar un ID único para la captura
        const captureId = Date.now().toString();
        
        // Guardar la captura en storage con el ID
        chrome.storage.local.set({ 
            ['capture_' + captureId]: {
                dataUrl: request.dataUrl,
                timestamp: Date.now()
            },
            lastCapture: request.dataUrl,
            captureTimestamp: Date.now()
        }, () => {
            // Abrir la imagen en una nueva pestaña
            const viewerUrl = chrome.runtime.getURL('viewer.html') + '?id=' + captureId;
            chrome.tabs.create({ url: viewerUrl });
            
            // Limpiar capturas antiguas (más de 1 hora)
            cleanupOldCaptures();
        });
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'areaCaptureError' || 
        request.action === 'areaSelectionCancelled') {
        // Reenviar al popup si está abierto
        chrome.runtime.sendMessage(request).catch(() => {
            // El popup puede no estar abierto, ignorar el error
        });
        sendResponse({ success: true });
        return true;
    }
    
    return false;
});
