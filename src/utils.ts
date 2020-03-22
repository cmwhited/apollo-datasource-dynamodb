import { DynamoDB } from 'aws-sdk';

import { CacheKeyItemMap } from './types';

/**
 * Build the cache key from the table and key info.
 * The cache key format is: `${prefix}${tableName}:${...[key-value]}`
 * Example:
 * - `prefix`: `dynamodbcache:`
 * - `tableName`: `test`
 * - `key`: { ['id']: 'testId', ['timestamp']: '2020-01-01 00:00:00' }
 * Cache Key
 * `dynamodbcache:test:id-testId:timestamp-2020-01-01 00:00:00`
 * @param cachePrefix the prefix for items in the cache
 * @param tableName the name of the DynamoDB table
 * @param key the key value for the record
 */
export const buildCacheKey = (cachePrefix: string, tableName: string, key: DynamoDB.DocumentClient.Key): string => {
  const keysStr = Object.entries(key).reduce((accum: string, curr: [string, string]) => {
    return `${accum}:${curr[0]}-${curr[1]}`;
  }, '');
  return `${cachePrefix}${tableName}${keysStr}`;
};

/**
 * Build the Key from the KeySchema and item
 * @param keySchema the tables key schema. defines the HASH, RANGE (optional) schema.
 * @param item the item to pull values from the key for
 */
export function buildKey<T>(keySchema: DynamoDB.DocumentClient.KeySchema, item: T): DynamoDB.DocumentClient.Key {
  return keySchema.reduce((prevKeys, keyElement: DynamoDB.DocumentClient.KeySchemaElement) => {
    return {
      ...prevKeys,
      [keyElement.AttributeName]: item[keyElement.AttributeName],
    };
  }, {});
}

/**
 * Use the key schema and items to build the Cache Key Item Map instance to use to save the items to the cache.
 * Example:
 * - keySchema:
 * ```js
 * [
 *  {
 *    AttributeName: 'id',
 *    KeyType: 'HASH'
 *  }
 * ]
 * ```
 * - items;
 * ```js
 * [
 *  {
 *    id: 'testId',
 *    test: 'testing'
 *  }
 * ]
 * ```
 * Returns:
 * ```js
 * {
 *  [dynamodbcache:test:id-testId]: {
 *    id: 'testId',
 *    test: 'testing'
 *  }
 * }
 * ```
 * @param cachePrefix the prefix for items in the cache
 * @param tableName the DynamoDB table name. used to build the cache key
 * @param keySchema the tables key schema. defines the HASH, RANGE (optional) schema.
 * @param items the items to set in the cash
 */
export function buildItemsCacheMap<T = unknown>(
  cachePrefix: string,
  tableName: string,
  keySchema: DynamoDB.DocumentClient.KeySchema,
  items: T[]
): CacheKeyItemMap<T> {
  return items.reduce((accum: {}, curr: T) => {
    const key: DynamoDB.DocumentClient.Key = buildKey(keySchema, curr);
    const cacheKey = buildCacheKey(cachePrefix, tableName, key);
    return {
      ...accum,
      [cacheKey]: curr,
    };
  }, {});
}
