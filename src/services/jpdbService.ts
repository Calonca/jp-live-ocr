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
  private baseUrl = 'https://jpdb.io/api/v1';
  private apiKey: string | null = null;

  constructor() {
    // Try to get API key from localStorage or environment
    this.apiKey = localStorage.getItem('jpdb_api_key') || null;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('jpdb_api_key', apiKey);
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    if (!this.apiKey) {
      throw new Error('JPDB API key not set. Please set your API key first.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid JPDB API key. Please check your API key.');
      }
      throw new Error(`JPDB API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Parse text and get token information including difficulty and known status
   */
  async parseText(text: string): Promise<JpdbParseResponse> {
    try {
      const response = await this.makeRequest('/parse', {
        text: text.trim(),
        position_length_encoding: 'utf16',
        token_fields: ['text', 'reading', 'part_of_speech', 'card_state', 'difficulty'],
      });

      return {
        tokens: response.tokens || [],
      };
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
   */
  async lookupWord(word: string): Promise<JpdbLookupResponse | null> {
    try {
      const response = await this.makeRequest('/lookup', {
        text: word.trim(),
        fields: ['meanings', 'reading', 'part_of_speech', 'frequency', 'card_state', 'difficulty'],
      });

      if (response.entries && response.entries.length > 0) {
        const entry = response.entries[0];
        return {
          word: word,
          reading: entry.reading,
          meanings: entry.meanings || [],
          part_of_speech: entry.part_of_speech,
          frequency: entry.frequency,
          card_state: entry.card_state,
          difficulty: entry.difficulty,
        };
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