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
  })

  it('properly splits text into displayable words using getDisplayWords method', () => {
    // Set up OCR result
    ;(wrapper.vm as any).ocrResult = 'こんにちは 世界'
    const words = (wrapper.vm as any).getDisplayWords()
    expect(words).toEqual([
      { text: 'こんにちは' },
      { text: '世界' }
    ])
  })

  it('handles word click events correctly', async () => {
    const mockEvent = { clientX: 100, clientY: 200 }
    const testWord = 'こんにちは'
    
    // Call the handleWordClick method directly
    await (wrapper.vm as any).handleWordClick(mockEvent, testWord)
    
    await wrapper.vm.$nextTick()
    
    expect((wrapper.vm as any).selectedWord).toBe(testWord)
    expect((wrapper.vm as any).showDictionary).toBe(true)
    expect((wrapper.vm as any).dictionaryPosition).toEqual({ x: 100, y: 200 })
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