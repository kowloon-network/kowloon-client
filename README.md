# Kowloon Client

Isomorphic JavaScript client library for Kowloon social network. Works seamlessly in:

- ✅ **Node.js** (18+)
- ✅ **Browsers** (modern browsers with fetch support)
- ✅ **React Native** (with AsyncStorage)

## Installation

```bash
npm install @kowloon/client
```

For React Native, also install AsyncStorage:

```bash
npm install @react-native-async-storage/async-storage
```

## Quick Start

```javascript
import { KowloonClient } from '@kowloon/client';

// Create client
const client = new KowloonClient({
  baseUrl: 'https://kowloon.org'
});

// Register a new user
const { user, token } = await client.auth.register({
  username: 'alice',
  password: 'secret123',
  email: 'alice@example.com',
  profile: {
    name: 'Alice',
    description: 'Just joined Kowloon!'
  }
});

// Login
await client.auth.login({
  username: 'alice',
  password: 'secret123'
});

// Check if authenticated
const isAuth = await client.auth.isAuthenticated(); // true

// Get current user
const currentUser = client.auth.getUser();

// Logout
await client.auth.logout();
```

## Session Management

The client automatically stores tokens and restores sessions:

```javascript
// First app load
const client = new KowloonClient({ baseUrl: 'https://kowloon.org' });

// Restore previous session
const user = await client.init();
if (user) {
  console.log('Restored session for', user.username);
} else {
  console.log('No previous session');
}
```

## API Reference

### `new KowloonClient(options)`

Create a new client instance.

**Options:**
- `baseUrl` (string, required) - Base URL of Kowloon server
- `storage` (object, optional) - Custom storage adapter
- `headers` (object, optional) - Default headers for all requests
- `timeout` (number, optional) - Request timeout in ms (default: 30000)

### Authentication (`client.auth`)

#### `register(credentials)`

Register a new user.

**Parameters:**
- `username` (string, required)
- `password` (string, required)
- `email` (string, optional)
- `profile` (object, optional)

**Returns:** `{ user, token }`

#### `login(credentials)`

Login with username/ID and password.

**Parameters:**
- `username` (string) - Username
- `id` (string) - User ID (@user@domain) - alternative to username
- `password` (string, required)

**Returns:** `{ user, token }`

#### `logout()`

Logout and clear session.

**Returns:** `Promise<void>`

#### `isAuthenticated()`

Check if user is currently authenticated.

**Returns:** `Promise<boolean>`

#### `getUser()`

Get current user object (synchronous).

**Returns:** `Object | null`

#### `getToken()`

Get current auth token.

**Returns:** `Promise<string | null>`

#### `restoreSession()`

Restore session from stored token.

**Returns:** `Promise<Object | null>` - User object if session restored

## Storage

The client automatically detects the environment and uses appropriate storage:

- **Browser**: `localStorage`
- **React Native**: `AsyncStorage` (requires `@react-native-async-storage/async-storage`)
- **Node.js**: In-memory storage (fallback)

### Custom Storage

You can provide a custom storage adapter:

```javascript
const customStorage = {
  async getItem(key) { /* ... */ },
  async setItem(key, value) { /* ... */ },
  async removeItem(key) { /* ... */ },
  async clear() { /* ... */ }
};

const client = new KowloonClient({
  baseUrl: 'https://kowloon.org',
  storage: customStorage
});
```

## Error Handling

All API errors are typed:

```javascript
import {
  AuthenticationError,
  ValidationError,
  NetworkError
} from '@kowloon/client';

try {
  await client.auth.login({ username: 'alice', password: 'wrong' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid credentials');
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
}
```

**Error Types:**
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `NotFoundError` (404)
- `ValidationError` (400)
- `ServerError` (500+)
- `NetworkError` (connection failures, timeouts)

## Development

### Running Tests

```bash
# Start Kowloon server first
cd ../server
npm start

# Run tests
cd ../client
npm test
```

### Environment Variables

- `KOWLOON_BASE_URL` - Base URL for tests (default: `http://localhost:3000`)

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

You may use, modify and redistribute this software, including commercially
and in closed-source products, provided you retain the copyright and licence
notices, state any changes you made, and include the `NOTICE` file. The
licence also grants an explicit patent licence from contributors, which
terminates for anyone who brings a patent claim against the project.
