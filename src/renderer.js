// DOM elements
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');
const screenshotPreview = document.getElementById('screenshot-preview');
const placeholderText = document.querySelector('.placeholder-text');

// Current screenshot data
let currentScreenshotData = null;

// Add event listeners
captureBtn.addEventListener('click', startCapture);
saveBtn.addEventListener('click', saveScreenshot);

// Start the capture process
function startCapture() {
  window.electronAPI.startCapture();
}

// Handle the captured sources and create screenshot
window.electronAPI.handleSourcesFetched((event, sources, captureArea) => {
  // We're focusing on the primary display for simplicity
  const primarySource = sources[0]; // Assuming the first source is the primary screen
  
  // Create a video element to receive the stream
  const video = document.createElement('video');
  video.style.display = 'none';
  video.style.width = captureArea.width + 'px';
  video.style.height = captureArea.height + 'px';
  document.body.appendChild(video);
  
  // Create a canvas to draw the captured portion
  const canvas = document.createElement('canvas');
  canvas.width = captureArea.width;
  canvas.height = captureArea.height;
  const ctx = canvas.getContext('2d');
  
  // Get the media stream
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primarySource.id
      }
    }
  }).then((stream) => {
    // Connect the video element to the stream
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      
      // After a short delay, capture the frame
      setTimeout(() => {
        // Draw the selected area to the canvas
        ctx.drawImage(
          video, 
          captureArea.x, captureArea.y, captureArea.width, captureArea.height,
          0, 0, captureArea.width, captureArea.height
        );
        
        // Convert the canvas to a data URL
        currentScreenshotData = canvas.toDataURL('image/png');
        
        // Display the screenshot
        screenshotPreview.src = currentScreenshotData;
        screenshotPreview.classList.remove('hidden');
        placeholderText.classList.add('hidden');
        
        // Enable the save button
        saveBtn.disabled = false;
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        video.remove();
      }, 100);
    };
  }).catch((error) => {
    console.error('Error getting screen media:', error);
  });
});

// Save the screenshot
async function saveScreenshot() {
  if (!currentScreenshotData) return;
  
  const result = await window.electronAPI.saveScreenshot(currentScreenshotData);
  
  if (result.success) {
    alert(`Screenshot saved to: ${result.filePath}`);
  } else {
    alert(`Failed to save screenshot: ${result.error}`);
  }
}