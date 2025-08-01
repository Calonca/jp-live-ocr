<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Tesseract from 'tesseract.js'
import { jpdbService, type JpdbToken, type JpdbLookupResponse } from '@/services/jpdbService'

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
const jpdbTokens = ref<JpdbToken[]>([])
const isParsing = ref(false)
const isLookingUp = ref(false)
const selectedWordInfo = ref<JpdbLookupResponse | null>(null)
const jpdbApiKey = ref(jpdbService.getApiKey() || '')
const showApiKeyInput = ref(!jpdbService.getApiKey())

// New reactive references for word overlays
const ocrWords = ref<Array<{
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  confidence: number
}>>([])
const imageContainerRef = ref<HTMLElement | null>(null)
const imageUploadRef = ref<HTMLInputElement | null>(null)

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

// Handle image upload for testing
const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      capturedImage.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// Perform OCR on captured image
const performOCR = async () => {
  if (!capturedImage.value) return

  isProcessing.value = true
  errorMessage.value = ''

  try {
    const { data } = await Tesseract.recognize(
      capturedImage.value,
      'jpn', // Japanese language
      {
        logger: m => console.log(m) // Optional: log progress
      }
    )
    
    // Store OCR results
    ocrResult.value = data.text.trim()
    
    // Store word data with bounding boxes
    if ((data as any).words) {
      ocrWords.value = (data as any).words.map((word: any) => ({
        text: word.text,
        bbox: word.bbox,
        confidence: word.confidence
      }))
      console.log('OCR Words with bounding boxes:', ocrWords.value)
    }
    
    // Parse text with jpdb if API key is available
    if (ocrResult.value && jpdbService.getApiKey()) {
      await parseTextWithJpdb(ocrResult.value)
    }
  } catch (error) {
    console.error('OCR Error:', error)
    errorMessage.value = 'OCR processing failed. Please try again.'
  } finally {
    isProcessing.value = false
  }
}

// Parse text with jpdb API
const parseTextWithJpdb = async (text: string) => {
  isParsing.value = true
  try {
    const response = await jpdbService.parseText(text)
    jpdbTokens.value = response.tokens
  } catch (error) {
    console.error('Error parsing with jpdb:', error)
    // Keep basic word splitting as fallback
    jpdbTokens.value = text.split(/(\s+)/).filter(word => word.trim().length > 0).map(word => ({
      text: word,
      card_state: 'new' as const,
    }))
  } finally {
    isParsing.value = false
  }
}

// Set jpdb API key
const setJpdbApiKey = () => {
  if (jpdbApiKey.value.trim()) {
    jpdbService.setApiKey(jpdbApiKey.value.trim())
    showApiKeyInput.value = false
    // Re-parse current text if available
    if (ocrResult.value) {
      parseTextWithJpdb(ocrResult.value)
    }
  }
}

// Show API key input
const showApiKeySettings = () => {
  showApiKeyInput.value = true
  jpdbApiKey.value = jpdbService.getApiKey() || ''
}

// Handle word click for dictionary (updated for overlays)
const handleWordClick = async (word: string) => {
  selectedWord.value = word.trim()
  if (selectedWord.value) {
    // Show dictionary in fixed position at bottom
    showDictionary.value = true
    selectedWordInfo.value = null
    
    // Look up word details if jpdb API key is available
    if (jpdbService.getApiKey()) {
      isLookingUp.value = true
      try {
        const wordInfo = await jpdbService.lookupWord(selectedWord.value)
        selectedWordInfo.value = wordInfo
      } catch (error) {
        console.error('Error looking up word:', error)
      } finally {
        isLookingUp.value = false
      }
    }
  }
}

// Close dictionary popup
const closeDictionary = () => {
  showDictionary.value = false
  selectedWord.value = ''
  selectedWordInfo.value = null
}

// Get jpdb token info for a specific word
const getJpdbTokenForWord = (wordText: string): JpdbToken | undefined => {
  return jpdbTokens.value.find(token => token.text.trim() === wordText.trim())
}

// Calculate overlay position and size
const getWordOverlayStyle = (bbox: { x0: number; y0: number; x1: number; y1: number }): Record<string, string> => {
  if (!imageRef.value) return {}
  
  const img = imageRef.value
  const imgRect = img.getBoundingClientRect()
  
  // Calculate scale factors
  const scaleX = img.clientWidth / img.naturalWidth
  const scaleY = img.clientHeight / img.naturalHeight
  
  // Scale the bounding box to match the displayed image size
  const left = bbox.x0 * scaleX
  const top = bbox.y0 * scaleY
  const width = (bbox.x1 - bbox.x0) * scaleX
  const height = (bbox.y1 - bbox.y0) * scaleY
  
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
}

// Get CSS class for word based on jpdb status
const getWordClass = (token?: JpdbToken): string => {
  const baseClass = 'clickable-word'
  if (token?.card_state) {
    return `${baseClass} ${jpdbService.getWordColorClass(token.card_state)}`
  }
  return baseClass
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
      
      <!-- jpdb API Key Setup -->
      <div v-if="showApiKeyInput" class="api-key-setup">
        <h3>🔑 jpdb API Key Setup</h3>
        <p>Enter your jpdb.io API key to enable word difficulty coloring and detailed dictionary lookups:</p>
        <div class="api-key-input">
          <input
            v-model="jpdbApiKey"
            type="password"
            placeholder="Enter your jpdb.io API key"
            class="api-key-field"
            @keyup.enter="setJpdbApiKey"
          />
          <button @click="setJpdbApiKey" class="btn btn-primary">Set API Key</button>
          <button @click="showApiKeyInput = false" class="btn btn-secondary">Skip</button>
        </div>
        <p class="api-key-help">
          <small>Get your API key from <a href="https://jpdb.io/settings" target="_blank">jpdb.io settings</a></small>
        </p>
      </div>

      <!-- jpdb Status -->
      <div v-if="!showApiKeyInput" class="jpdb-status">
        <span v-if="jpdbService.getApiKey()" class="jpdb-enabled">
          ✅ jpdb integration enabled
          <button @click="showApiKeySettings" class="btn-link">⚙️ Settings</button>
        </span>
        <span v-else class="jpdb-disabled">
          ⚠️ jpdb integration disabled
          <button @click="showApiKeySettings" class="btn-link">Setup API Key</button>
        </span>
      </div>
      
      <!-- Error message -->
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- Camera section with word overlays -->
      <div class="camera-section" ref="imageContainerRef">
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="video-feed"
          :class="{ hidden: capturedImage }"
        ></video>
        
        <!-- Captured image with word overlays -->
        <div v-if="capturedImage" class="image-container">
          <img
            ref="imageRef"
            :src="capturedImage"
            alt="Captured image"
            class="captured-image"
            @load="$forceUpdate()" 
          />
          
          <!-- Word overlays -->
          <div
            v-for="(word, index) in ocrWords"
            :key="`word-${index}`"
            :style="getWordOverlayStyle(word.bbox)"
            @click="handleWordClick(word.text)"
            :class="['word-overlay', getWordClass(getJpdbTokenForWord(word.text))]"
            :title="`${word.text} (confidence: ${Math.round(word.confidence)}%)`"
          >
            <!-- Invisible content to make the overlay clickable -->
          </div>
        </div>
        
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
        
        <!-- Test image upload (for development/testing) -->
        <div v-if="!capturedImage" class="test-upload">
          <input
            type="file"
            accept="image/*"
            @change="handleImageUpload"
            ref="imageUploadRef"
            style="display: none;"
          />
          <button
            @click="imageUploadRef?.click()"
            class="btn btn-secondary"
          >
            📁 Upload Test Image
          </button>
        </div>
        
        <div v-else class="capture-controls">
          <button
            @click="performOCR"
            class="btn btn-success"
            :disabled="isProcessing"
          >
            {{ isProcessing ? '🔄 Processing...' : '🔍 Perform OCR' }}
          </button>
          
          <button
            @click="() => { capturedImage = ''; ocrResult = ''; ocrWords = []; }"
            class="btn btn-secondary"
          >
            📷 Take New Photo
          </button>
        </div>
      </div>

      <!-- Fixed Dictionary Panel (replaces OCR results section) -->
      <div v-if="ocrResult" class="dictionary-panel">
        <div class="dictionary-panel-header">
          <h2 v-if="!showDictionary">OCR Complete - Click on words in the image above</h2>
          <h2 v-else>Dictionary</h2>
          <button 
            v-if="showDictionary" 
            @click="closeDictionary" 
            class="close-dictionary-btn"
          >
            ✕ Close
          </button>
        </div>
        
        <div v-if="isParsing" class="parsing-status">
          🔄 Analyzing text with jpdb...
        </div>
        
        <!-- Dictionary content (shown when a word is selected) -->
        <div v-if="showDictionary" class="dictionary-content">
          <p><strong>Word:</strong> {{ selectedWord }}</p>
          
          <div v-if="isLookingUp" class="loading">
            🔄 Looking up word...
          </div>
          
          <div v-else-if="selectedWordInfo" class="word-details">
            <div v-if="selectedWordInfo.reading" class="reading">
              <strong>Reading:</strong> {{ selectedWordInfo.reading }}
            </div>
            <div v-if="selectedWordInfo.part_of_speech" class="pos">
              <strong>Part of Speech:</strong> {{ selectedWordInfo.part_of_speech }}
            </div>
            <div v-if="selectedWordInfo.meanings.length > 0" class="meanings">
              <strong>Meanings:</strong>
              <ul>
                <li v-for="meaning in selectedWordInfo.meanings" :key="meaning">
                  {{ meaning }}
                </li>
              </ul>
            </div>
            <div v-if="selectedWordInfo.card_state" class="card-state">
              <strong>Card State:</strong> 
              <span :class="jpdbService.getWordColorClass(selectedWordInfo.card_state)">
                {{ selectedWordInfo.card_state }}
              </span>
            </div>
            <div v-if="selectedWordInfo.frequency" class="frequency">
              <strong>Frequency:</strong> {{ selectedWordInfo.frequency }}
            </div>
            <div v-if="selectedWordInfo.difficulty" class="difficulty">
              <strong>Difficulty:</strong> {{ selectedWordInfo.difficulty }}
            </div>
          </div>
          
          <div v-else-if="!jpdbService.getApiKey()" class="no-api-key">
            <p><em>Set up jpdb API key for detailed word information.</em></p>
            <button @click="showApiKeySettings" class="btn btn-primary btn-small">Setup API Key</button>
          </div>
          
          <div v-else class="no-data">
            <p><em>No dictionary data found for this word.</em></p>
          </div>
        </div>
        
        <!-- Instructions when no word is selected -->
        <div v-else class="instructions">
          <p>{{ ocrWords.length }} words detected. Click on any highlighted word in the image above to see its dictionary entry.</p>
          
          <div v-if="jpdbService.getApiKey()" class="jpdb-legend">
            <small>
              <span class="legend-item">
                <span class="jpdb-known">■</span> Known
              </span>
              <span class="legend-item">
                <span class="jpdb-learning">■</span> Learning
              </span>
              <span class="legend-item">
                <span class="jpdb-new">■</span> New
              </span>
              <span class="legend-item">
                <span class="jpdb-suspended">■</span> Suspended
              </span>
              <span class="legend-item">
                <span class="jpdb-locked">■</span> Locked
              </span>
            </small>
          </div>
        </div>
      </div>

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

.api-key-setup {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.api-key-setup h3 {
  margin-top: 0;
  color: #495057;
}

.api-key-input {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.api-key-field {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
}

.api-key-help {
  margin-bottom: 0;
  color: #6c757d;
}

.jpdb-status {
  text-align: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.jpdb-enabled {
  color: #155724;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.jpdb-disabled {
  color: #856404;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.btn-link {
  background: none;
  border: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  margin-left: 0.5rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
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

.image-container {
  position: relative;
  display: inline-block;
}

.video-feed,
.captured-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  display: block;
}

.video-feed.hidden {
  display: none;
}

/* Word overlay styles */
.word-overlay {
  cursor: pointer;
  border: 2px solid rgba(0, 123, 255, 0.7);
  background-color: rgba(0, 123, 255, 0.1);
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.word-overlay:hover {
  border-color: rgba(0, 123, 255, 1);
  background-color: rgba(0, 123, 255, 0.2);
}

/* jpdb word coloring for overlays */
.word-overlay.jpdb-known {
  border-color: rgba(46, 125, 50, 0.8);
  background-color: rgba(200, 230, 201, 0.3);
}

.word-overlay.jpdb-learning {
  border-color: rgba(245, 124, 0, 0.8);
  background-color: rgba(255, 243, 224, 0.3);
}

.word-overlay.jpdb-new {
  border-color: rgba(198, 40, 40, 0.8);
  background-color: rgba(255, 235, 238, 0.3);
}

.word-overlay.jpdb-suspended {
  border-color: rgba(123, 31, 162, 0.8);
  background-color: rgba(243, 229, 245, 0.3);
}

.word-overlay.jpdb-locked {
  border-color: rgba(69, 90, 100, 0.8);
  background-color: rgba(236, 239, 241, 0.3);
}

.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.test-upload {
  display: flex;
  justify-content: center;
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

/* Fixed Dictionary Panel (replaces OCR results) */
.dictionary-panel {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  min-height: 200px;
}

.dictionary-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.dictionary-panel-header h2 {
  margin: 0;
  color: #495057;
  font-size: 1.25rem;
}

.close-dictionary-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.close-dictionary-btn:hover {
  background: #c82333;
}

.instructions {
  color: #6c757d;
  text-align: center;
  padding: 2rem 1rem;
}

.instructions p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.parsing-status {
  color: #007bff;
  font-style: italic;
  margin-bottom: 0.5rem;
  text-align: center;
}

.dictionary-content {
  color: #555;
}

.loading {
  color: #007bff;
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

.word-details .reading,
.word-details .pos,
.word-details .meanings,
.word-details .card-state,
.word-details .frequency,
.word-details .difficulty {
  margin-bottom: 0.5rem;
}

.word-details ul {
  margin: 0.25rem 0;
  padding-left: 1.5rem;
}

.word-details li {
  margin-bottom: 0.25rem;
}

.card-state span {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
}

.no-api-key,
.no-data {
  text-align: center;
  padding: 1rem 0;
}

/* jpdb word coloring */
.jpdb-known {
  background-color: #c8e6c9;
  color: #2e7d32;
}

.jpdb-learning {
  background-color: #fff3e0;
  color: #f57c00;
}

.jpdb-new {
  background-color: #ffebee;
  color: #c62828;
}

.jpdb-suspended {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.jpdb-locked {
  background-color: #eceff1;
  color: #455a64;
}

.jpdb-legend {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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
  
  .dictionary-panel {
    margin-top: 0.5rem;
    padding: 0.75rem;
  }
  
  .dictionary-panel-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .dictionary-panel-header h2 {
    font-size: 1.1rem;
  }
  
  .close-dictionary-btn {
    align-self: flex-end;
  }
  
  .word-overlay {
    min-width: 20px;
    min-height: 20px;
  }
  
  .jpdb-legend {
    gap: 0.5rem;
    font-size: 0.875rem;
  }
}
</style>
