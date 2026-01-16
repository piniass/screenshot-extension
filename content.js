// Content script para capturar toda la página completa

// Escuchar mensajes desde el popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureFullPage') {
        captureFullPage().then((dataUrl) => {
            sendResponse({ success: true, dataUrl: dataUrl });
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Mantener el canal abierto para respuesta asíncrona
    }
});

async function captureFullPage() {
    return new Promise((resolve, reject) => {
        try {
            // Guardar la posición de scroll original
            const originalScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const originalScrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            // Obtener dimensiones completas de la página
            const pageHeight = Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.clientHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
            
            const pageWidth = Math.max(
                document.body.scrollWidth,
                document.body.offsetWidth,
                document.documentElement.clientWidth,
                document.documentElement.scrollWidth,
                document.documentElement.offsetWidth
            );
            
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Crear canvas para la imagen completa
            const canvas = document.createElement('canvas');
            canvas.width = pageWidth;
            canvas.height = pageHeight;
            const ctx = canvas.getContext('2d');
            
            // Fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageWidth, pageHeight);
            
            // Calcular secciones a capturar - cada sección cubre exactamente viewportHeight
            const sections = [];
            let currentY = 0;
            
            while (currentY < pageHeight) {
                const sectionHeight = Math.min(viewportHeight, pageHeight - currentY);
                sections.push({
                    scrollY: currentY,
                    drawY: currentY,
                    height: sectionHeight
                });
                currentY += viewportHeight;
            }
            
            // Capturar cada sección secuencialmente
            let sectionIndex = 0;
            
            // Función para esperar a que el scroll se complete y se renderice
            function waitForScroll(targetY, callback, maxAttempts = 10) {
                let attempts = 0;
                
                function checkScroll() {
                    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
                    
                    if (Math.abs(currentScrollY - targetY) <= 2 || attempts >= maxAttempts) {
                        // Scroll está en posición o máximo de intentos alcanzado
                        // Esperar a que se renderice completamente
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                // Esperar un poco más para elementos lazy-loaded y animaciones
                                setTimeout(callback, 600);
                            });
                        });
                    } else {
                        // Ajustar scroll si es necesario
                        window.scrollTo(0, targetY);
                        attempts++;
                        setTimeout(checkScroll, 100);
                    }
                }
                
                checkScroll();
            }
            
            function captureNextSection() {
                if (sectionIndex >= sections.length) {
                    // Restaurar scroll original
                    window.scrollTo(originalScrollLeft, originalScrollTop);
                    
                    // Esperar un momento antes de generar la imagen final
                    setTimeout(() => {
                        // Convertir a data URL
                        const dataUrl = canvas.toDataURL('image/png');
                        resolve(dataUrl);
                    }, 200);
                    return;
                }
                
                const section = sections[sectionIndex];
                
                // Scroll a la posición exacta
                window.scrollTo(0, section.scrollY);
                
                // Esperar a que el scroll se complete y se renderice
                waitForScroll(section.scrollY, () => {
                    // Capturar esta sección
                    chrome.runtime.sendMessage({
                        action: 'captureVisibleSection'
                    }, (response) => {
                        if (response && response.success && response.dataUrl) {
                            const img = new Image();
                            img.onload = () => {
                                // Dibujar la imagen completa en la posición exacta del canvas
                                // La imagen capturada es del tamaño del viewport visible
                                // La dibujamos exactamente en la posición Y correspondiente sin gaps
                                ctx.drawImage(
                                    img, 
                                    0, 
                                    section.drawY
                                );
                                
                                sectionIndex++;
                                captureNextSection();
                            };
                            img.onerror = () => {
                                sectionIndex++;
                                captureNextSection();
                            };
                            img.src = response.dataUrl;
                        } else {
                            sectionIndex++;
                            captureNextSection();
                        }
                    });
                });
            }
            
            // Iniciar la captura
            captureNextSection();
            
        } catch (error) {
            reject(error);
        }
    });
}

