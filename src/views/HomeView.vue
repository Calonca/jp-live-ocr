<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Tesseract from 'tesseract.js'

// Reactive references
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const stream = ref<MediaStream | null>(null)
const capturedImage = ref<string>('')
const ocrResult = ref<string>('')
const isProcessing = ref(false)
const errorMessage = ref('')
const selectedWord = ref('')
const showDictionary = ref(false)
const dictionaryPosition = ref({ x: 0, y: 0 })

// Start camera
const startCamera = async () => {
  try {
    errorMessage.value = ''
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' } // Use back camera on mobile
    })
    stream.value = mediaStream
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
    }
  } catch (error) {
    console.error('Error accessing camera:', error)
    errorMessage.value = 'Could not access camera. Please check permissions.'
  }
}

// Stop camera
const stopCamera = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

// Capture image from video
const captureImage = () => {
  if (!videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')

  if (!context) return

  // Set canvas size to match video
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Draw video frame to canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  // Convert canvas to image data URL
  capturedImage.value = canvas.toDataURL('image/png')
}

// Perform OCR on captured image
const performOCR = async () => {
  if (!capturedImage.value) return

  isProcessing.value = true
  errorMessage.value = ''

  try {
    const { data: { text } } = await Tesseract.recognize(
      capturedImage.value,
      'jpn', // Japanese language
      {
        logger: m => console.log(m) // Optional: log progress
      }
    )
    ocrResult.value = text.trim()
  } catch (error) {
    console.error('OCR Error:', error)
    errorMessage.value = 'OCR processing failed. Please try again.'
  } finally {
    isProcessing.value = false
  }
}

// Handle word click for dictionary
const handleWordClick = (event: MouseEvent, word: string) => {
  selectedWord.value = word.trim()
  if (selectedWord.value) {
    dictionaryPosition.value = { x: event.clientX, y: event.clientY }
    showDictionary.value = true
  }
}

// Close dictionary popup
const closeDictionary = () => {
  showDictionary.value = false
  selectedWord.value = ''
}

// Split text into clickable words
const getClickableWords = (text: string) => {
  return text.split(/(\s+)/).filter(word => word.trim().length > 0)
}

// Lifecycle hooks
onMounted(() => {
  startCamera()
})

onUnmounted(() => {
  stopCamera()
})
</script>

<template>
  <main class="camera-ocr-app">
    <div class="container">
      <h1>日本語 Live OCR</h1>
      
      <!-- Error message -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- Camera section -->
      <div class="camera-section">
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="video-feed"
          :class="{ hidden: capturedImage }"
        ></video>
        
        <!-- Captured image -->
        <img
          v-if="capturedImage"
          ref="imageRef"
          :src="capturedImage"
          alt="Captured image"
          class="captured-image"
        />
        
        <!-- Hidden canvas for image capture -->
        <canvas ref="canvasRef" style="display: none;"></canvas>
      </div>

      <!-- Control buttons -->
      <div class="controls">
        <button
          v-if="!capturedImage"
          @click="captureImage"
          class="btn btn-primary"
          :disabled="!videoRef"
        >
          📷 Capture Image
        </button>
        
        <div v-else class="capture-controls">
          <button
            @click="performOCR"
            class="btn btn-success"
            :disabled="isProcessing"
          >
            {{ isProcessing ? '🔄 Processing...' : '🔍 Perform OCR' }}
          </button>
          
          <button
            @click="() => { capturedImage = ''; ocrResult = ''; }"
            class="btn btn-secondary"
          >
            📷 Take New Photo
          </button>
        </div>
      </div>

      <!-- OCR Results -->
      <div v-if="ocrResult" class="ocr-results">
        <h2>OCR Results:</h2>
        <div class="ocr-text">
          <span
            v-for="word in getClickableWords(ocrResult)"
            :key="word"
            @click="(event) => handleWordClick(event, word)"
            class="clickable-word"
          >
            {{ word }}
          </span>
        </div>
      </div>

      <!-- Dictionary Popup -->
      <div
        v-if="showDictionary"
        class="dictionary-popup"
        :style="{ left: dictionaryPosition.x + 'px', top: dictionaryPosition.y + 'px' }"
        @click.stop
      >
        <div class="dictionary-header">
          <h3>Dictionary</h3>
          <button @click="closeDictionary" class="close-btn">×</button>
        </div>
        <div class="dictionary-content">
          <p><strong>Word:</strong> {{ selectedWord }}</p>
          <p><em>Dictionary API integration coming soon...</em></p>
        </div>
      </div>

      <!-- Overlay to close dictionary -->
      <div
        v-if="showDictionary"
        class="dictionary-overlay"
        @click="closeDictionary"
      ></div>
    </div>
  </main>
</template>

<style scoped>
.camera-ocr-app {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #fcc;
}

.camera-section {
  position: relative;
  display: flex;
  justify-content: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  min-height: 300px;
}

.video-feed,
.captured-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}

.video-feed.hidden {
  display: none;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.capture-controls {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ocr-results {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.ocr-results h2 {
  margin-top: 0;
  color: #495057;
}

.ocr-text {
  line-height: 1.6;
  font-size: 1.1rem;
}

.clickable-word {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.2s;
  display: inline-block;
  margin: 1px;
}

.clickable-word:hover {
  background-color: #e3f2fd;
  color: #1976d2;
}

.dictionary-popup {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  min-width: 250px;
  max-width: 400px;
  z-index: 1000;
  transform: translate(-50%, -100%);
}

.dictionary-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

.dictionary-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  margin-left: auto;
}

.close-btn:hover {
  color: #333;
}

.dictionary-content {
  color: #555;
}

.dictionary-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  z-index: 999;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .camera-ocr-app {
    padding: 0.5rem;
  }
  
  .controls {
    flex-direction: column;
    align-items: center;
  }
  
  .capture-controls {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
