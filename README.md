# Fallback Chain Library

Priority-based fallback execution for Node.js.

## Features

- **Priority-based**: Items tried in priority order
- **Health Checks**: Skip unhealthy items
- **Timeout**: Per-item timeout support
- **Events**: Full event emission

## Installation

```bash
npm install fallback-chain-lib
```

## Usage

```typescript
import { FallbackChain } from 'fallback-chain-lib';

const chain = new FallbackChain();

chain.add({
  name: 'primary',
  priority: 1,
  execute: async (req) => { /* ... */ },
  healthCheck: async () => true
});

chain.add({
  name: 'secondary',
  priority: 2,
  execute: async (req) => { /* ... */ }
});

const result = await chain.execute('request');
```

## Events

- `success` - When an item succeeds
- `error` - When an item fails
- `fallback` - When fallback occurs
- `skipped` - When an item is skipped

## License

MIT
