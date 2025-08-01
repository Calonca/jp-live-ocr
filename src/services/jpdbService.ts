// jpdb API service for dictionary integration
// Based on jpdb API documentation and common patterns

export interface JpdbToken {
  text: string;
  reading?: string;
  part_of_speech?: string;
  meanings?: string[];
  card_state?: 'known' | 'learning' | 'new' | 'suspended' | 'locked';
  difficulty?: number;
}

export interface JpdbParseResponse {
  tokens: JpdbToken[];
}

export interface JpdbLookupResponse {
  word: string;
  reading?: string;
  meanings: string[];
  part_of_speech?: string;
  frequency?: number;
  card_state?: 'known' | 'learning' | 'new' | 'suspended' | 'locked';
  difficulty?: number;
}

class JpdbService {
  private baseUrl = 'https://jpdb.io';
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from localStorage or environment
    this.apiKey = localStorage.getItem('jpdb_api_key') || this.getEnvironmentApiKey() || null;
  }

  private getEnvironmentApiKey(): string | null {
    // In development/testing, try to get from global environment
    // Use globalThis to avoid Node.js specific types
    try {
      const globalProcess = (globalThis as unknown as { process?: { env?: { JPDB_API_KEY?: string } } }).process;
      if (globalProcess?.env?.JPDB_API_KEY) {
        return globalProcess.env.JPDB_API_KEY;
      }
    } catch {
      // Ignore errors accessing global process
    }
    return null;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('jpdb_api_key', apiKey);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  private async makeRequest(endpoint: string, data: unknown): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('JPDB API key not set. Please set your API key first.');
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid JPDB API key. Please check your API key.');
      }
      throw new Error(`JPDB API error: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    if (!responseText) {
      return {}; // Handle empty responses like ping
    }

    const responseData = JSON.parse(responseText);
    
    // Check for JPDB error format
    if (responseData && typeof responseData === 'object' && 'error_message' in responseData) {
      throw new Error(responseData.error_message);
    }

    return responseData;
  }

  /**
   * Test API connection and key validity
   */
  async ping(): Promise<boolean> {
    try {
      await this.makeRequest('ping', undefined);
      return true;
    } catch (error) {
      console.error('JPDB ping failed:', error);
      return false;
    }
  }

  /**
   * Parse text and get token information including difficulty and known status
   */
  async parseText(text: string): Promise<JpdbParseResponse> {
    try {
      const response = await this.makeRequest('parse', {
        text: [text.trim()], // Send as array of strings
        position_length_encoding: 'utf16',
        token_fields: ['vocabulary_index', 'position', 'length', 'furigana'],
        vocabulary_fields: [
          'vid',
          'sid',
          'rid',
          'spelling',
          'reading',
          'frequency_rank',
          'part_of_speech',
          'meanings_chunks',
          'meanings_part_of_speech',
          'card_state',
          'pitch_accent',
        ],
      });

      // Transform response to match our interface
      const tokens: JpdbToken[] = [];
      const typedResponse = response as {
        tokens?: Array<Array<{ vocabulary_index?: number; position: number; length: number }>>;
        vocabulary?: Array<{
          spelling?: string;
          reading?: string;
          part_of_speech?: string[];
          meanings_chunks?: Array<{ meaning: string }>;
          card_state?: string[];
          frequency_rank?: number;
        }>;
      };
      
      if (typedResponse.tokens && typedResponse.tokens.length > 0) {
        for (const token of typedResponse.tokens[0]) { // First paragraph's tokens
          if (token.vocabulary_index !== undefined && typedResponse.vocabulary) {
            const vocab = typedResponse.vocabulary[token.vocabulary_index];
            if (vocab) {
              tokens.push({
                text: vocab.spelling || '',
                reading: vocab.reading,
                part_of_speech: vocab.part_of_speech?.[0],
                meanings: vocab.meanings_chunks?.map((chunk: { meaning: string }) => chunk.meaning) || [],
                card_state: vocab.card_state?.[0] as JpdbToken['card_state'],
                difficulty: vocab.frequency_rank,
              });
            }
          } else {
            // Handle non-vocabulary tokens (whitespace, punctuation)
            tokens.push({
              text: text.substring(token.position, token.position + token.length),
              card_state: 'new',
            });
          }
        }
      }

      return { tokens };
    } catch (error) {
      console.error('Error parsing text with JPDB:', error);
      // Return fallback response for offline/error cases
      return {
        tokens: text.split(/(\s+)/).filter(word => word.trim().length > 0).map(word => ({
          text: word,
          card_state: 'new' as const,
        })),
      };
    }
  }

  /**
   * Look up detailed information for a specific word
   * Note: This is a simplified implementation since lookup-vocabulary requires vid/sid pairs
   */
  async lookupWord(word: string): Promise<JpdbLookupResponse | null> {
    try {
      // First parse the word to get vocabulary information
      const parseResponse = await this.parseText(word);
      if (parseResponse.tokens.length > 0) {
        const token = parseResponse.tokens.find(t => t.text.trim() === word.trim());
        if (token) {
          return {
            word: word,
            reading: token.reading,
            meanings: token.meanings || [],
            part_of_speech: token.part_of_speech,
            frequency: token.difficulty,
            card_state: token.card_state,
            difficulty: token.difficulty,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error looking up word with JPDB:', error);
      return null;
    }
  }

  /**
   * Get color class based on card state for word highlighting
   */
  getWordColorClass(cardState?: string): string {
    switch (cardState) {
      case 'known':
        return 'jpdb-known';
      case 'learning':
        return 'jpdb-learning';
      case 'suspended':
        return 'jpdb-suspended';
      case 'locked':
        return 'jpdb-locked';
      case 'new':
      default:
        return 'jpdb-new';
    }
  }
}

// Export singleton instance
export const jpdbService = new JpdbService();