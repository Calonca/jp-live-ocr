import { describe, it, expect, vi, beforeEach } from 'vitest'
import { jpdbService } from '@/services/jpdbService'

// Test with environment API key if available
const TEST_API_KEY = process.env.JPDB_API_KEY || 'affa3037dcf9758fc4442fdf3479d8c1'

describe('JpdbService API Integration', () => {
  beforeEach(() => {
    // Clear any existing API key
    localStorage.clear()
    jpdbService.setApiKey('')
  })

  it('should set and get API key correctly', () => {
    expect(jpdbService.getApiKey()).toBe('')
    
    jpdbService.setApiKey(TEST_API_KEY)
    expect(jpdbService.getApiKey()).toBe(TEST_API_KEY)
  })

  it('should store API key in localStorage', () => {
    jpdbService.setApiKey(TEST_API_KEY)
    expect(localStorage.getItem('jpdb_api_key')).toBe(TEST_API_KEY)
  })

  it('should handle missing API key appropriately', async () => {
    jpdbService.setApiKey('')
    
    // The ping method returns false when there's no API key
    const pingResult = await jpdbService.ping()
    expect(pingResult).toBe(false)
    
    // For parseText, verify it falls back to simple splitting
    const result = await jpdbService.parseText('test word')
    expect(result.tokens).toHaveLength(2)
    expect(result.tokens[0].text).toBe('test')
    expect(result.tokens[1].text).toBe('word')
  })

  it('should handle API errors gracefully', async () => {
    // Set an invalid API key
    jpdbService.setApiKey('invalid-key')
    
    // Mock fetch to return 401
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized'
    })
    
    await expect(jpdbService.ping()).resolves.toBe(false)
  })

  it('should provide fallback parsing when API fails', async () => {
    jpdbService.setApiKey('invalid-key')
    
    // Mock fetch to throw network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    const result = await jpdbService.parseText('こんにちは 世界')
    expect(result.tokens).toHaveLength(2)
    expect(result.tokens[0].text).toBe('こんにちは')
    expect(result.tokens[1].text).toBe('世界')
    expect(result.tokens[0].card_state).toBe('new')
  })

  it('should handle word color classes correctly', () => {
    expect(jpdbService.getWordColorClass('known')).toBe('jpdb-known')
    expect(jpdbService.getWordColorClass('learning')).toBe('jpdb-learning')
    expect(jpdbService.getWordColorClass('new')).toBe('jpdb-new')
    expect(jpdbService.getWordColorClass('suspended')).toBe('jpdb-suspended')
    expect(jpdbService.getWordColorClass('locked')).toBe('jpdb-locked')
    expect(jpdbService.getWordColorClass(undefined)).toBe('jpdb-new')
  })

  // Integration test (only if we can access the API)
  it.skip('should successfully ping JPDB API with valid key', async () => {
    jpdbService.setApiKey(TEST_API_KEY)
    
    const result = await jpdbService.ping()
    expect(result).toBe(true)
  }, 10000) // 10 second timeout for network call
})