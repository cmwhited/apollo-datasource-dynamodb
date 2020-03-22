import { DataSource, DataSourceConfig } from 'apollo-datasource';
import { DynamoDB } from 'aws-sdk';
import { ClientConfiguration } from 'aws-sdk/clients/dynamodb';

import { DynamoDBCache, DynamoDBCacheImpl, CACHE_PREFIX_KEY } from './DynamoDBCache';
import { buildItemsCacheMap, buildCacheKey, buildKey } from './utils';
import { CacheKeyItemMap } from './types';

/**
 * Data Source to interact with DynamoDB.
 * @param ITEM the type of the item to retrieve from the DynamoDB table
 */
export abstract class DynamoDBDataSource<ITEM = unknown, TContext = unknown> extends DataSource {
  readonly dynamoDbDocClient: DynamoDB.DocumentClient;
  readonly tableName!: string;
  readonly tableKeySchema!: DynamoDB.DocumentClient.KeySchema;
  dynamodbCache!: DynamoDBCache<ITEM>;
  context!: TContext;

  constructor(tableName: string, tableKeySchema: DynamoDB.DocumentClient.KeySchema, config?: ClientConfiguration) {
    super();
    this.tableName = tableName;
    this.tableKeySchema = tableKeySchema;
    this.dynamoDbDocClient = new DynamoDB.DocumentClient({
      apiVersion: '2012-08-10',
      ...config,
    });
  }

  initialize({ context, cache }: DataSourceConfig<TContext>): void {
    this.context = context;
    this.dynamodbCache = new DynamoDBCacheImpl(this.dynamoDbDocClient, cache);
    console.log('DynamoDBDataSource has been initialized with context', this.context);
  }

  /**
   * Retrieve the item with the given `GetItemInput`.
   * - Attempt to retrieve the item from the cache.
   * - If the item does not exist in the cache, retrieve the item from the table, then add the item to the cache
   * @param getItemInput the input that provides information about which record to retrieve from the cache/dynamodb table
   * @param ttl the time-to-live value of the item in the cache. determines how long the item persists in the cache
   */
  async getItem(getItemInput: DynamoDB.DocumentClient.GetItemInput, ttl?: number): Promise<ITEM> {
    return await this.dynamodbCache.getItem(getItemInput, ttl);
  }

  /**
   * Query for a list of records by the given query input.
   * If the ttl has a value, and items are returned, store the items in the cache
   * @param queryInput the defined query that tells the document client which records to retrieve from the table
   * @param ttl the time-to-live value of the item in the cache. determines how long the item persists in the cache
   */
  async query(queryInput: DynamoDB.DocumentClient.QueryInput, ttl?: number): Promise<ITEM[]> {
    const output = await this.dynamoDbDocClient.query(queryInput).promise();
    const items: ITEM[] = output.Items as ITEM[];

    // store the items in the cache
    if (items.length && ttl) {
      const cacheKeyItemMap: CacheKeyItemMap<ITEM> = buildItemsCacheMap(
        CACHE_PREFIX_KEY,
        this.tableName,
        this.tableKeySchema,
        items
      );
      await this.dynamodbCache.setItemsInCache(cacheKeyItemMap, ttl);
    }

    return items;
  }

  /**
   * Scan for a list of records by the given scan input.
   * If the ttl has a value, and items are returned, store the items in the cache
   * @param scanInput the scan input that tell the document client how to scan for records in the table
   * @param ttl the time-to-live value of the item in the cache. determines how long the item persists in the cache
   */
  async scan(scanInput: DynamoDB.DocumentClient.ScanInput, ttl?: number): Promise<ITEM[]> {
    const output = await this.dynamoDbDocClient.scan(scanInput).promise();
    const items: ITEM[] = output.Items as ITEM[];

    // store the items in the cache
    if (items.length && ttl) {
      const cacheKeyItemMap: CacheKeyItemMap<ITEM> = buildItemsCacheMap(
        CACHE_PREFIX_KEY,
        this.tableName,
        this.tableKeySchema,
        items
      );
      await this.dynamodbCache.setItemsInCache(cacheKeyItemMap, ttl);
    }

    return items;
  }

  /**
   * Store the item in the table and add the item to the cache
   * @param item the item to store in the table
   * @param ttl the time-to-live value of how long to persist the item in the cache
   */
  async put(item: ITEM, ttl?: number): Promise<ITEM> {
    const putItemInput: DynamoDB.DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: item,
    };
    await this.dynamoDbDocClient.put(putItemInput).promise();

    if (ttl) {
      const key: DynamoDB.DocumentClient.Key = buildKey(this.tableKeySchema, item);
      const cacheKey: string = buildCacheKey(CACHE_PREFIX_KEY, this.tableName, key);
      await this.dynamodbCache.setInCache(cacheKey, item, ttl);
    }

    return item;
  }

  /**
   * Update the item in the table and reset the item in the cache
   * @param key the key of the item in the table to update
   * @param ttl the time-to-live value of how long to persist the item in the cache
   */
  async update(
    key: DynamoDB.DocumentClient.Key,
    updateExpression: DynamoDB.DocumentClient.UpdateExpression,
    expressionAttributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap,
    expressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap,
    ttl?: number
  ): Promise<ITEM> {
    const updateItemInput: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: key,
      ReturnValues: 'ALL_NEW',
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };
    const output = await this.dynamoDbDocClient.update(updateItemInput).promise();
    const updated: ITEM = output.Attributes as ITEM;

    if (updated && ttl) {
      const cacheKey: string = buildCacheKey(CACHE_PREFIX_KEY, this.tableName, key);
      await this.dynamodbCache.setInCache(cacheKey, updated, ttl);
    }

    return updated;
  }

  /**
   * Delete the given item from the table
   * @param key the key of the item to delete from the table
   */
  async delete(key: DynamoDB.DocumentClient.Key): Promise<void> {
    const deleteItemInput: DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: this.tableName,
      Key: key,
    };

    await this.dynamoDbDocClient.delete(deleteItemInput).promise();

    await this.dynamodbCache.removeItemFromCache(this.tableName, key);
  }
}
