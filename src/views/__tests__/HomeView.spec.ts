import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'

// Mock Tesseract.js
vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(() => 
      Promise.resolve({
        data: { text: 'こんにちは 世界' }
      })
    )
  }
}))

// Mock getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => 
      Promise.resolve({
        getTracks: () => [{ stop: vi.fn() }]
      })
    )
  },
  writable: true
})

describe('HomeView OCR Functionality', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(HomeView)
  })

  it('renders the main title', () => {
    expect(wrapper.find('h1').text()).toBe('日本語 Live OCR')
  })

  it('shows capture button initially', () => {
    const captureButton = wrapper.find('button')
    expect(captureButton.text()).toContain('Capture Image')
  })

  it('has the correct initial state for OCR functionality', () => {
    expect(wrapper.vm.ocrResult).toBe('')
    expect(wrapper.vm.isProcessing).toBe(false)
    expect(wrapper.vm.showDictionary).toBe(false)
    expect(wrapper.vm.selectedWord).toBe('')
  })

  it('properly splits text into clickable words using getClickableWords method', () => {
    const testText = 'こんにちは 世界'
    const words = wrapper.vm.getClickableWords(testText)
    expect(words).toEqual(['こんにちは', '世界'])
  })

  it('handles word click events correctly', async () => {
    const mockEvent = { clientX: 100, clientY: 200 }
    const testWord = 'こんにちは'
    
    // Call the handleWordClick method directly
    wrapper.vm.handleWordClick(mockEvent, testWord)
    
    await wrapper.vm.$nextTick()
    
    expect(wrapper.vm.selectedWord).toBe(testWord)
    expect(wrapper.vm.showDictionary).toBe(true)
    expect(wrapper.vm.dictionaryPosition).toEqual({ x: 100, y: 200 })
  })

  it('closes dictionary when closeDictionary is called', async () => {
    // Set up dictionary state
    wrapper.vm.showDictionary = true
    wrapper.vm.selectedWord = 'テスト'
    
    await wrapper.vm.$nextTick()
    
    // Call close method
    wrapper.vm.closeDictionary()
    
    await wrapper.vm.$nextTick()
    
    expect(wrapper.vm.showDictionary).toBe(false)
    expect(wrapper.vm.selectedWord).toBe('')
  })
})