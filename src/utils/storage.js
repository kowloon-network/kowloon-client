// Isomorphic storage abstraction for tokens
// Works in Node.js, browsers, and React Native

/**
 * Detect environment and choose appropriate storage
 */
function detectStorage() {
  // React Native (AsyncStorage)
  if (typeof global !== 'undefined' && global.navigator?.product === 'ReactNative') {
    try {
      // Dynamic import for React Native AsyncStorage
      // User needs to install: @react-native-async-storage/async-storage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return new AsyncStorageAdapter(AsyncStorage);
    } catch (e) {
      // Falling back to MemoryStorage means sessions don't survive an app
      // restart -- not cosmetic. Logging e.message (not just a generic
      // string) so a future "why am I getting logged out" investigation has
      // the actual native-module error to go on instead of nothing.
      console.warn(`React Native detected but AsyncStorage not available (${e?.message || e}). Using memory storage.`);
      return new MemoryStorage();
    }
  }

  // Browser (localStorage)
  if (typeof window !== 'undefined' && window.localStorage) {
    return new LocalStorageAdapter(window.localStorage);
  }

  // Node.js (memory fallback - could use file-based in production)
  return new MemoryStorage();
}

/**
 * Memory storage (fallback for Node.js or when other storage unavailable)
 */
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  async getItem(key) {
    return this.store.get(key) || null;
  }

  async setItem(key, value) {
    this.store.set(key, value);
  }

  async removeItem(key) {
    this.store.delete(key);
  }

  async clear() {
    this.store.clear();
  }
}

/**
 * LocalStorage adapter (browser)
 */
class LocalStorageAdapter {
  constructor(localStorage) {
    this.storage = localStorage;
  }

  async getItem(key) {
    try {
      return this.storage.getItem(key);
    } catch (e) {
      console.error('LocalStorage getItem error:', e);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      this.storage.setItem(key, value);
    } catch (e) {
      console.error('LocalStorage setItem error:', e);
    }
  }

  async removeItem(key) {
    try {
      this.storage.removeItem(key);
    } catch (e) {
      console.error('LocalStorage removeItem error:', e);
    }
  }

  async clear() {
    try {
      this.storage.clear();
    } catch (e) {
      console.error('LocalStorage clear error:', e);
    }
  }
}

/**
 * AsyncStorage adapter (React Native)
 */
class AsyncStorageAdapter {
  constructor(asyncStorage) {
    this.storage = asyncStorage;
  }

  async getItem(key) {
    try {
      return await this.storage.getItem(key);
    } catch (e) {
      console.error('AsyncStorage getItem error:', e);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      await this.storage.setItem(key, value);
    } catch (e) {
      console.error('AsyncStorage setItem error:', e);
    }
  }

  async removeItem(key) {
    try {
      await this.storage.removeItem(key);
    } catch (e) {
      console.error('AsyncStorage removeItem error:', e);
    }
  }

  async clear() {
    try {
      await this.storage.clear();
    } catch (e) {
      console.error('AsyncStorage clear error:', e);
    }
  }
}

// Default storage instance
const defaultStorage = detectStorage();

/**
 * Get token from storage
 * @param {string} key - Storage key (defaults to 'kowloon_token')
 * @param {Object} storage - Custom storage adapter
 * @returns {Promise<string|null>}
 */
export async function getToken(key = 'kowloon_token', storage = defaultStorage) {
  return await storage.getItem(key);
}

/**
 * Save token to storage
 * @param {string} token - JWT token
 * @param {string} key - Storage key (defaults to 'kowloon_token')
 * @param {Object} storage - Custom storage adapter
 * @returns {Promise<void>}
 */
export async function setToken(token, key = 'kowloon_token', storage = defaultStorage) {
  if (!token) {
    await storage.removeItem(key);
  } else {
    await storage.setItem(key, token);
  }
}

/**
 * Remove token from storage
 * @param {string} key - Storage key (defaults to 'kowloon_token')
 * @param {Object} storage - Custom storage adapter
 * @returns {Promise<void>}
 */
export async function removeToken(key = 'kowloon_token', storage = defaultStorage) {
  await storage.removeItem(key);
}

/**
 * Clear all storage
 * @param {Object} storage - Custom storage adapter
 * @returns {Promise<void>}
 */
export async function clearStorage(storage = defaultStorage) {
  await storage.clear();
}

export { MemoryStorage, LocalStorageAdapter, AsyncStorageAdapter, detectStorage };
