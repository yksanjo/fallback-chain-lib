/**
 * Fallback Chain Module
 * 
 * Implements a simple fallback chain for agents with priority-based selection
 */

import { EventEmitter } from 'events';

export interface Chainable {
  name: string;
  priority: number;
  execute?(request: unknown): Promise<unknown>;
  healthCheck?(): Promise<boolean>;
}

export interface FallbackChainOptions {
  /** Maximum time to try each item in ms */
  timeoutPerItem?: number;
  /** Continue on error or stop */
  continueOnError?: boolean;
  /** Callback when fallback occurs */
  onFallback?: (from: string, to: string) => void;
}

/**
 * Fallback Chain - tries items in priority order
 */
export class FallbackChain extends EventEmitter {
  private items: Chainable[] = [];
  private options: Required<FallbackChainOptions>;

  constructor(options: FallbackChainOptions = {}) {
    super();
    this.options = {
      timeoutPerItem: options.timeoutPerItem || 30000,
      continueOnError: options.continueOnError ?? true,
      onFallback: options.onFallback || (() => {}),
    };
  }

  /**
   * Add an item to the chain
   */
  add(item: Chainable): void {
    this.items.push(item);
    this.items.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove an item from the chain
   */
  remove(name: string): void {
    this.items = this.items.filter(item => item.name !== name);
  }

  /**
   * Get all items in priority order
   */
  getItems(): Chainable[] {
    return [...this.items];
  }

  /**
   * Execute the chain - tries each item until one succeeds
   */
  async execute<T>(request: unknown): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      
      // Skip if health check fails
      if (item.healthCheck) {
        const healthy = await item.healthCheck();
        if (!healthy) {
          this.emit('skipped', { name: item.name, reason: 'unhealthy' });
          continue;
        }
      }

      try {
        // Execute with timeout
        if (item.execute) {
          const result = await this.executeWithTimeout<T>(item.execute, request);
          this.emit('success', { name: item.name, index: i });
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.emit('error', { name: item.name, error: lastError });

        // Trigger fallback if not last item
        if (i < this.items.length - 1) {
          const nextItem = this.items[i + 1];
          this.options.onFallback(item.name, nextItem.name);
          this.emit('fallback', { from: item.name, to: nextItem.name });
        }

        if (!this.options.continueOnError) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All items in fallback chain failed');
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: (request: unknown) => Promise<T>,
    request: unknown
  ): Promise<T> {
    return Promise.race([
      fn(request),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), this.options.timeoutPerItem)
      ),
    ]);
  }

  /**
   * Get the first available item
   */
  async getFirstAvailable(): Promise<Chainable | null> {
    for (const item of this.items) {
      if (item.healthCheck) {
        const healthy = await item.healthCheck();
        if (healthy) return item;
      } else {
        return item;
      }
    }
    return null;
  }

  /**
   * Get item by name
   */
  get(name: string): Chainable | undefined {
    return this.items.find(item => item.name === name);
  }

  /**
   * Get count of items
   */
  get length(): number {
    return this.items.length;
  }
}

/**
 * Create a simple fallback function
 */
export function createFallbackChain<T>(
  items: Chainable[],
  options?: FallbackChainOptions
): FallbackChain {
  const chain = new FallbackChain(options);
  items.forEach(item => chain.add(item));
  return chain;
}
