// renderer.js: Renderer process script for the screenshot app UI

// DOM elements
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');
const screenshotContainer = document.getElementById('screenshot-container');
const placeholderText = document.querySelector('.placeholder-text');
const imageFormatSelect = document.getElementById('image-format');

// Store up to 10 screenshots in history
let screenshotHistory = [];

// Add event listeners for buttons
captureBtn.addEventListener('click', startCapture);
saveBtn.addEventListener('click', saveScreenshot);

// Start the capture process by sending a message to the main process
function startCapture() {
  // Get the selected modes and format from the toggles
  const selectionMode = document.querySelector('input[name="selection-mode"]:checked').value;
  const captureMode = document.querySelector('input[name="capture-mode"]:checked').value;
  const imageFormat = imageFormatSelect.value;
  window.electronAPI.startCapture({ selectionMode, captureMode, imageFormat });
}

// Update the preview panel with the current screenshot history
function updatePreview() {
  screenshotContainer.innerHTML = '';
  
  if (screenshotHistory.length === 0) {
    placeholderText.classList.remove('hidden');
    saveBtn.disabled = true;
    return;
  }
  
  placeholderText.classList.add('hidden');
  saveBtn.disabled = false;
  
  screenshotHistory.forEach((dataUrl, index) => {
    const screenshotWrapper = document.createElement('div');
    screenshotWrapper.className = 'screenshot-wrapper';
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'screenshot';
    img.draggable = true;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', () => {
      screenshotHistory.splice(index, 1);
      updatePreview();
    });
    
    screenshotWrapper.appendChild(img);
    screenshotWrapper.appendChild(deleteBtn);
    screenshotContainer.appendChild(screenshotWrapper);
  });
}

// Handle the captured sources and create the screenshot
window.electronAPI.handleSourcesFetched((event, sources, captureArea, imageFormat) => {
  const primarySource = sources[0];
  
  // Create a hidden video element to stream the desktop
  const video = document.createElement('video');
  video.style.display = 'none';
  video.style.width = captureArea.width + 'px';
  video.style.height = captureArea.height + 'px';
  document.body.appendChild(video);
  
  // Create a canvas to draw the captured frame
  const canvas = document.createElement('canvas');
  canvas.width = captureArea.width;
  canvas.height = captureArea.height;
  const ctx = canvas.getContext('2d');
  
  // Request desktop stream using getUserMedia
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primarySource.id
      }
    }
  }).then((stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      
      // Failsafe: Wait until the video frame is ready and non-blank
      function captureFrame(attempts = 0, maxAttempts = 10) {
        if (attempts >= maxAttempts) {
          console.error('Failed to capture non-blank frame after maximum attempts');
          finalizeCapture(null);
          return;
        }
        
        // Draw the current frame to the canvas
        ctx.drawImage(
          video,
          captureArea.x, captureArea.y, captureArea.width, captureArea.height,
          0, 0, captureArea.width, captureArea.height
        );
        
        // Check if the frame is blank (all pixels are black or white)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let isBlank = true;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (!((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255))) {
            isBlank = false;
            break;
          }
        }
        
        if (isBlank) {
          console.log(`Frame is blank, retrying (${attempts + 1}/${maxAttempts})...`);
          setTimeout(() => captureFrame(attempts + 1, maxAttempts), 100);
        } else {
          let mimeType = `image/${imageFormat}`;
          let quality = 1.0; // Default quality
          if (imageFormat === 'jpeg') {
            quality = 0.8; // JPEG quality (0.0 to 1.0)
          } else if (imageFormat === 'webp') {
            quality = 0.9; // WebP quality
          }
          // Note: AVIF support depends on the Electron/Chromium version
          try {
            const dataUrl = canvas.toDataURL(mimeType, quality);
            finalizeCapture(dataUrl);
          } catch (error) {
            console.warn(`Failed to generate ${imageFormat}, falling back to PNG:`, error);
            const dataUrl = canvas.toDataURL('image/png');
            finalizeCapture(dataUrl);
          }
        }
      }
      
      // Finalize the capture process
      function finalizeCapture(dataUrl) {
        if (dataUrl) {
          screenshotHistory.unshift(dataUrl);
          if (screenshotHistory.length > 10) {
            screenshotHistory.pop();
          }
          updatePreview();
        } else {
          console.error('Failed to capture screenshot');
        }
        
        window.electronAPI.showMainWindow();
        stream.getTracks().forEach(track => track.stop());
        video.remove();
      }
      
      // Start capturing the frame
      captureFrame();
    };
  }).catch((error) => {
    console.error('Error getting screen media:', error);
    window.electronAPI.showMainWindow();
  });
});

// Save the most recent screenshot to the downloads folder
async function saveScreenshot() {
  if (screenshotHistory.length === 0) return;
  
  const imageFormat = imageFormatSelect.value;
  const result = await window.electronAPI.saveScreenshot(screenshotHistory[0], imageFormat);
  
  if (result.success) {
    alert(`Screenshot saved to: ${result.filePath}`);
  } else {
    alert(`Failed to save screenshot: ${result.error}`);
  }
}

// Drag-and-drop functionality to copy the screenshot to the clipboard
document.addEventListener('dragstart', (event) => {
  const img = event.target;
  if (img.className === 'screenshot') {
    console.log('Starting drag with image:', img.src.substring(0, 50) + '...');
    window.electronAPI.copyImageToClipboard(img.src);
    event.dataTransfer.setData('text/uri-list', img.src);
    event.dataTransfer.setData('text/plain', img.src);
  }
});

// End of renderer.js