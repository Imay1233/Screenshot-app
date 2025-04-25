// DOM elements
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');
const screenshotContainer = document.getElementById('screenshot-container');
const placeholderText = document.querySelector('.placeholder-text');

// Store up to 10 screenshots
let screenshotHistory = [];

// Add event listeners
captureBtn.addEventListener('click', startCapture);
saveBtn.addEventListener('click', saveScreenshot);

// Start the capture process
function startCapture() {
  window.electronAPI.startCapture();
}

// Update the preview panel with all screenshots
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

// Handle the captured sources and create screenshot
window.electronAPI.handleSourcesFetched((event, sources, captureArea) => {
  const primarySource = sources[0];
  const video = document.createElement('video');
  video.style.display = 'none';
  video.style.width = captureArea.width + 'px';
  video.style.height = captureArea.height + 'px';
  document.body.appendChild(video);
  const canvas = document.createElement('canvas');
  canvas.width = captureArea.width;
  canvas.height = captureArea.height;
  const ctx = canvas.getContext('2d');
  
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
      setTimeout(() => {
        ctx.drawImage(
          video,
          captureArea.x, captureArea.y, captureArea.width, captureArea.height,
          0, 0, captureArea.width, captureArea.height
        );
        const dataUrl = canvas.toDataURL('image/png');
        
        screenshotHistory.unshift(dataUrl);
        if (screenshotHistory.length > 10) {
          screenshotHistory.pop();
        }
        
        window.electronAPI.showMainWindow();
        updatePreview();
        
        stream.getTracks().forEach(track => track.stop());
        video.remove();
      }, 100);
    };
  }).catch((error) => {
    console.error('Error getting screen media:', error);
    window.electronAPI.showMainWindow();
  });
});

// Save the most recent screenshot
async function saveScreenshot() {
  if (screenshotHistory.length === 0) return;
  
  const result = await window.electronAPI.saveScreenshot(screenshotHistory[0]);
  
  if (result.success) {
    alert(`Screenshot saved to: ${result.filePath}`);
  } else {
    alert(`Failed to save screenshot: ${result.error}`);
  }
}

// Drag-and-drop functionality
document.addEventListener('dragstart', (event) => {
  const img = event.target;
  if (img.className === 'screenshot') {
    console.log('Starting drag with image:', img.src.substring(0, 50) + '...');
    window.electronAPI.copyImageToClipboard(img.src);
    event.dataTransfer.setData('text/uri-list', img.src);
    event.dataTransfer.setData('text/plain', img.src);
  }
});