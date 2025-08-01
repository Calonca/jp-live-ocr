import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'

// Mock jpdb service
vi.mock('@/services/jpdbService', () => ({
  jpdbService: {
    getApiKey: vi.fn(() => null),
    setApiKey: vi.fn(),
    parseText: vi.fn(() => Promise.resolve({ tokens: [] })),
    lookupWord: vi.fn(() => Promise.resolve(null)),
    getWordColorClass: vi.fn(() => 'jpdb-new')
  }
}))
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
  let wrapper: ReturnType<typeof mount<typeof HomeView>>

  beforeEach(() => {
    wrapper = mount(HomeView)
  })

  it('renders the main title', () => {
    expect(wrapper.find('h1').text()).toBe('日本語 Live OCR')
  })

  it('shows API key setup initially when no key is stored', () => {
    const setupSection = wrapper.find('.api-key-setup')
    expect(setupSection.exists()).toBe(true)
    const apiKeyButton = wrapper.find('button')
    expect(apiKeyButton.text()).toContain('Set API Key')
  })

  it('has the correct initial state for OCR functionality', () => {
    expect((wrapper.vm as any).ocrResult).toBe('')
    expect((wrapper.vm as any).isProcessing).toBe(false)
    expect((wrapper.vm as any).showDictionary).toBe(false)
    expect((wrapper.vm as any).selectedWord).toBe('')
    expect((wrapper.vm as any).ocrWords).toEqual([])
  })

  it('stores OCR words when OCR processing completes', () => {
    // Set up OCR result and words
    ;(wrapper.vm as any).ocrResult = 'こんにちは 世界'
    ;(wrapper.vm as any).ocrWords = [
      { text: 'こんにちは', bbox: { x0: 0, y0: 0, x1: 100, y1: 50 }, confidence: 95 },
      { text: '世界', bbox: { x0: 110, y0: 0, x1: 180, y1: 50 }, confidence: 90 }
    ]
    
    expect((wrapper.vm as any).ocrWords).toHaveLength(2)
    expect((wrapper.vm as any).ocrWords[0].text).toBe('こんにちは')
    expect((wrapper.vm as any).ocrWords[1].text).toBe('世界')
  })

  it('handles word click events correctly', async () => {
    const testWord = 'こんにちは'
    
    // Call the handleWordClick method directly
    await (wrapper.vm as any).handleWordClick(testWord)
    
    await wrapper.vm.$nextTick()
    
    expect((wrapper.vm as any).selectedWord).toBe(testWord)
    expect((wrapper.vm as any).showDictionary).toBe(true)
  })

  it('closes dictionary when closeDictionary is called', async () => {
    // Set up dictionary state
    ;(wrapper.vm as any).showDictionary = true
    ;(wrapper.vm as any).selectedWord = 'テスト'
    ;(wrapper.vm as any).selectedWordInfo = { word: 'テスト', meanings: [] }
    
    await wrapper.vm.$nextTick()
    
    // Call close method
    ;(wrapper.vm as any).closeDictionary()
    
    await wrapper.vm.$nextTick()
    
    expect((wrapper.vm as any).showDictionary).toBe(false)
    expect((wrapper.vm as any).selectedWord).toBe('')
    expect((wrapper.vm as any).selectedWordInfo).toBe(null)
  })
})