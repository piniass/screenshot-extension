# Extensión de Captura de Pantalla

Una extensión de navegador moderna para hacer capturas de pantalla fácilmente.

## Características

- 📷 **Captura Vista Actual**: Captura exactamente lo que estás viendo en el navegador en este momento
- ✂️ **Seleccionar Área**: Dibuja un rectángulo sobre la página para capturar solo el área que deseas
- 💾 Descarga de capturas en formato PNG
- 📋 Copia al portapapeles
- 🎨 Interfaz moderna y fácil de usar

## Instalación

1. Abre Chrome/Edge y ve a `chrome://extensions/` o `edge://extensions/`
2. Activa el "Modo de desarrollador" (Developer mode) en la esquina superior derecha
3. Haz clic en "Cargar extensión sin empaquetar" (Load unpacked)
4. Selecciona la carpeta `first-extension`
5. ¡Listo! La extensión debería aparecer en tu barra de herramientas

## Uso

1. Haz clic en el icono de la extensión en la barra de herramientas
2. Elige una opción:
   - **📷 Capturar Vista Actual**: Captura exactamente lo que estás viendo en la pestaña actual (la parte visible sin scroll)
   - **✂️ Seleccionar Área**: Se cerrará el popup y podrás dibujar un rectángulo sobre la página para seleccionar exactamente el área que deseas capturar. Arrastra el mouse para seleccionar y suelta para capturar. Presiona ESC para cancelar.
3. Una vez capturada, verás una vista previa y podrás:
   - **Descargar**: Guardar la imagen en formato PNG en tu dispositivo
   - **Copiar al Portapapeles**: Copiar la imagen para pegarla en otras aplicaciones
   - **Nueva Captura**: Hacer otra captura

## Archivos

- `manifest.json`: Configuración de la extensión
- `popup.html`: Interfaz principal de la extensión
- `popup.css`: Estilos de la interfaz
- `popup.js`: Lógica principal de captura
- `background.js`: Service worker para manejar eventos en segundo plano y capturas
- `selector.js`: Script que se inyecta en las páginas para permitir seleccionar un área personalizada
- `shot-photo.png`: Icono de la extensión

## Permisos

La extensión requiere los siguientes permisos:
- `activeTab`: Para capturar la pestaña actual
- `tabs`: Para acceder a información de las pestañas
- `scripting`: Para inyectar scripts que permiten capturar toda la página completa

## Notas

- La extensión funciona en Chrome y Edge (basados en Chromium)
- Las capturas se guardan en formato PNG
- Para la selección de área, asegúrate de que el área que quieres capturar esté visible en la pantalla (dentro del viewport)
- Puedes presionar ESC para cancelar la selección de área en cualquier momento

