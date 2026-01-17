// Script para la página de visualización de capturas

let imageDataUrl = null;

// Obtener el dataUrl de la imagen desde los parámetros de la URL o storage
function loadImage() {
    const urlParams = new URLSearchParams(window.location.search);
    const imageId = urlParams.get('id');
    
    if (imageId) {
        // Obtener la imagen desde storage usando el ID
        chrome.storage.local.get(['capture_' + imageId], (result) => {
            const storedData = result['capture_' + imageId];
            if (storedData && storedData.dataUrl) {
                displayImage(storedData.dataUrl);
            } else {
                showError('No se pudo cargar la imagen');
            }
        });
    } else {
        // Intentar obtener la última captura
        chrome.storage.local.get(['lastCapture'], (result) => {
            if (result.lastCapture) {
                displayImage(result.lastCapture);
            } else {
                showError('No se encontró ninguna captura');
            }
        });
    }
}

function displayImage(dataUrl) {
    imageDataUrl = dataUrl;
    const img = document.getElementById('captureImage');
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    
    img.onload = () => {
        loading.style.display = 'none';
        content.style.display = 'block';
    };
    
    img.onerror = () => {
        showError('Error al cargar la imagen');
    };
    
    img.src = dataUrl;
}

function showError(message) {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const status = document.getElementById('status');
    
    loading.style.display = 'none';
    content.style.display = 'block';
    status.textContent = message;
    status.className = 'status error';
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// Botón de descarga
document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!imageDataUrl) {
        showStatus('No hay imagen para descargar', 'error');
        return;
    }
    
    try {
        // Convertir dataUrl a blob
        fetch(imageDataUrl)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const filename = `captura-${Date.now()}.png`;
                
                // Usar la API de descargas de Chrome
                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        // Si falla, usar método alternativo
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    } else {
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                    }
                    showStatus('Imagen descargada exitosamente', 'success');
                });
            })
            .catch(error => {
                console.error('Error al descargar:', error);
                showStatus('Error al descargar: ' + error.message, 'error');
            });
    } catch (error) {
        console.error('Error:', error);
        showStatus('Error al descargar: ' + error.message, 'error');
    }
});

// Botón de cerrar
document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
});

// Cargar la imagen al iniciar
window.addEventListener('DOMContentLoaded', loadImage);


