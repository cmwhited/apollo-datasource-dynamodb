import { KeyValueCache, InMemoryLRUCache, PrefixingKeyValueCache } from 'apollo-server-caching';
import { ApolloError } from 'apollo-server-errors';
import { DynamoDB } from 'aws-sdk';

import { buildCacheKey } from './utils';
import { CacheKeyItemMap } from './types';

export const CACHE_PREFIX_KEY = 'dynamodbcache:';
export const TTL_SEC = 30 * 60; // the default time-to-live value for the cache in seconds

export interface DynamoDBCache<T = unknown> {
  getItem: (getItemInput: DynamoDB.DocumentClient.GetItemInput, ttl?: number) => Promise<T>;
  setInCache: (key: string, item: T, ttl: number) => Promise<void>;
  setItemsInCache: (items: CacheKeyItemMap<T>, ttl: number) => Promise<void>;
  removeItemFromCache: (tableName: string, key: DynamoDB.DocumentClient.Key) => Promise<boolean | void>;
}

export class DynamoDBCacheImpl<T = unknown> implements DynamoDBCache<T> {
  readonly keyValueCache: KeyValueCache;
  readonly docClient: DynamoDB.DocumentClient;

  /**
   * Construct a new instance of `DynamoDBCache` with the given configuration
   * @param docClient the DynamoDB.DocumentClient instance
   * @param keyValueCache the key value caching client used to cache and retrieve records
   */
  constructor(docClient: DynamoDB.DocumentClient, keyValueCache: KeyValueCache = new InMemoryLRUCache()) {
    this.keyValueCache = new PrefixingKeyValueCache(keyValueCache, CACHE_PREFIX_KEY);
    this.docClient = docClient;
  }

  /**
   * Attempt to retrieve the item from the KeyValueCache instance
   * @param key the key of item in the cache
   */
  async retrieveFromCache(key: string): Promise<T | undefined> {
    try {
      const itemFromCache: string | undefined = await this.keyValueCache.get(key);
      if (itemFromCache) {
        return JSON.parse(itemFromCache) as T;
      }
    } catch (err) {
      return undefined;
    }
    return undefined;
  }

  /**
   * Set the found item in the cache instance
   * @param key the key of the item to set in the cache
   * @param item the item to store in the cache
   * @param ttl cache time to live of the item
   */
  async setInCache(key: string, item: T, ttl: number = TTL_SEC): Promise<void> {
    return await this.keyValueCache.set(key, JSON.stringify(item), { ttl });
  }

  /**
   * Store all of the given items in the cache
   * @param items the items to store in the cache. the object key value is the cache key
   * @param ttl cache time to live of the item
   */
  async setItemsInCache(items: CacheKeyItemMap<T>, ttl: number = TTL_SEC): Promise<void> {
    return Object.entries(items).forEach(async (item: [string, T]) => {
      return await this.setInCache(item[0], item[1], ttl);
    });
  }

  /**
   * Retrieve the item with the given `GetItemInput`.
   * - Attempt to retrieve the item from the cache.
   * - If the item does not exist in the cache, retrieve the item from the table, then add the item to the cache
   * @param getItemInput the input that provides information about which record to retrieve from the cache/dynamodb table
   * @param ttl the time-to-live value of the item in the cache. determines how long the item persists in the cache
   */
  async getItem(getItemInput: DynamoDB.DocumentClient.GetItemInput, ttl?: number): Promise<T> {
    try {
      const cacheKey = buildCacheKey(CACHE_PREFIX_KEY, getItemInput.TableName, getItemInput.Key);
      const itemFromCache: T | undefined = await this.retrieveFromCache(cacheKey);
      if (itemFromCache) {
        return itemFromCache;
      }

      // item is not in cache, retrieve from DynamoDB, if found, set in cache, otherwise throw ApolloError
      const output: DynamoDB.DocumentClient.GetItemOutput = await this.docClient.get(getItemInput).promise();
      const item: T | undefined = output.Item as T;

      await this.setInCache(cacheKey, item, ttl);

      return item;
    } catch (err) {
      throw new ApolloError(err?.message || 'An error occurred attempting to retrieve the item');
    }
  }

  /**
   * Remove an item from the cache.
   * @param tableName the table name the item belong in. used to build the cache key
   * @param key the dynamodb key value of the record. used to build the cache key
   */
  async removeItemFromCache(tableName: string, key: DynamoDB.DocumentClient.Key): Promise<boolean | void> {
    try {
      const cacheKey = buildCacheKey(CACHE_PREFIX_KEY, tableName, key);
      return await this.keyValueCache.delete(cacheKey);
    } catch (err) {
      throw new ApolloError(err?.message || 'An error occurred trying to evict the item from the cache');
    }
  }
}
