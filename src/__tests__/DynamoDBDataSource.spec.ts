import { ApolloError } from 'apollo-server-errors';
import { DataSourceConfig } from 'apollo-datasource';
import { DynamoDB } from 'aws-sdk';
import { ClientConfiguration, DocumentClient } from 'aws-sdk/clients/dynamodb';

import { DynamoDBDataSource } from '../DynamoDBDataSource';
import { CACHE_PREFIX_KEY } from '../DynamoDBCache';
import { buildItemsCacheMap } from '../utils';
import { CacheKeyItemMap } from '../types';

const { MOCK_DYNAMODB_ENDPOINT } = process.env;

interface TestHashOnlyItem {
  id: string;
  test: string;
}

class TestHashOnly extends DynamoDBDataSource<TestHashOnlyItem> {
  constructor(tableName: string, tableKeySchema: DynamoDB.DocumentClient.KeySchema, config?: ClientConfiguration) {
    super(tableName, tableKeySchema, config);
  }

  initialize(config: DataSourceConfig<{}>): void {
    super.initialize(config);
  }
}

const keySchema: DynamoDB.DocumentClient.KeySchema = [
  {
    AttributeName: 'id',
    KeyType: 'HASH',
  },
];
const testHashOnly = new TestHashOnly('test_hash_only', keySchema, {
  region: 'local',
  endpoint: MOCK_DYNAMODB_ENDPOINT,
  sslEnabled: false,
});
testHashOnly.initialize({ context: {}, cache: null });

const testHashOnlyItem: TestHashOnlyItem = {
  id: 'testId',
  test: 'testing',
};
const items: TestHashOnlyItem[] = [testHashOnlyItem];

beforeAll(async () => {
  await testHashOnly.dynamoDbDocClient
    .put({
      TableName: testHashOnly.tableName,
      Item: testHashOnlyItem,
    })
    .promise();
});

afterAll(async () => {
  await testHashOnly.dynamoDbDocClient
    .delete({
      TableName: testHashOnly.tableName,
      Key: { id: 'testId' },
    })
    .promise();
});

describe('DynamoDBDataSource', () => {
  it('initializes a new TestHashOnly and instantiates props', () => {
    expect(testHashOnly.dynamoDbDocClient).toBeDefined();
    expect(testHashOnly.tableName).toBeDefined();
    expect(testHashOnly.tableKeySchema).toBeDefined();
    expect(testHashOnly.dynamodbCache).toBeDefined();
  });

  describe('getItem', () => {
    const dynamodbCacheGetItemMock = jest.spyOn(testHashOnly.dynamodbCache, 'getItem');

    afterEach(() => {
      dynamodbCacheGetItemMock.mockReset();
    });
    afterAll(() => {
      dynamodbCacheGetItemMock.mockRestore();
    });

    it('should return a TestHashOnly item', async () => {
      const getItemInput: DynamoDB.DocumentClient.GetItemInput = {
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId',
        },
      };

      dynamodbCacheGetItemMock.mockResolvedValueOnce(testHashOnlyItem);

      const actual = await testHashOnly.getItem(getItemInput);

      expect(actual).toEqual(testHashOnlyItem);
      expect(dynamodbCacheGetItemMock).toBeCalledWith(getItemInput, undefined);
    });

    it('should throw an ApolloError if an issue occurs retrieving the record', async () => {
      const getItemInput: DynamoDB.DocumentClient.GetItemInput = {
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId',
        },
      };

      dynamodbCacheGetItemMock.mockRejectedValueOnce(new ApolloError('Error'));

      await expect(testHashOnly.getItem(getItemInput)).rejects.toThrowError(new ApolloError('Error'));
      expect(dynamodbCacheGetItemMock).toBeCalledWith(getItemInput, undefined);
    });
  });

  const dynamodbCacheSetItemsInCacheMock = jest.spyOn(testHashOnly.dynamodbCache, 'setItemsInCache');
  const dynamodbCacheSetInCacheMock = jest.spyOn(testHashOnly.dynamodbCache, 'setInCache');

  afterEach(() => {
    dynamodbCacheSetItemsInCacheMock.mockReset();
    dynamodbCacheSetInCacheMock.mockReset();
  });
  afterAll(() => {
    dynamodbCacheSetItemsInCacheMock.mockRestore();
    dynamodbCacheSetInCacheMock.mockRestore();
  });

  it('query should return a list of TestHashOnlyItem records and add items to the cache', async () => {
    const queryInput: DynamoDB.DocumentClient.QueryInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': 'testId',
      },
    };
    const ttl = 30;

    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: testHashOnlyItem,
      })
      .promise();

    dynamodbCacheSetItemsInCacheMock.mockResolvedValueOnce();

    const actual: TestHashOnlyItem[] = await testHashOnly.query(queryInput, ttl);
    const cacheKeyItemMap: CacheKeyItemMap<TestHashOnlyItem> = buildItemsCacheMap(
      CACHE_PREFIX_KEY,
      testHashOnly.tableName,
      testHashOnly.tableKeySchema,
      actual
    );

    expect(actual).toEqual(items);
    expect(dynamodbCacheSetItemsInCacheMock).toBeCalledWith(cacheKeyItemMap, ttl);
  });

  it('query should return an empty list. setItemsInCache should not be invoked', async () => {
    const queryInput: DynamoDB.DocumentClient.QueryInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': 'testId',
      },
    };
    const ttl = 30;

    const actual: TestHashOnlyItem[] = await testHashOnly.query(queryInput, ttl);

    expect(actual).toEqual([]);
    expect(dynamodbCacheSetItemsInCacheMock).not.toBeCalled();
  });

  it('query should return a list of TestHashOnlyItem records but not add items to cache because of no ttl', async () => {
    const queryInput: DynamoDB.DocumentClient.QueryInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': 'testId',
      },
    };

    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: testHashOnlyItem,
      })
      .promise();

    const actual: TestHashOnlyItem[] = await testHashOnly.query(queryInput);

    expect(actual).toEqual(items);
    expect(dynamodbCacheSetItemsInCacheMock).not.toBeCalled();
  });

  it('scan should return a list of TestHashOnlyItem records and add items to the cache', async () => {
    const scanInput: DynamoDB.DocumentClient.ScanInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
    };
    const ttl = 30;

    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: testHashOnlyItem,
      })
      .promise();

    dynamodbCacheSetItemsInCacheMock.mockResolvedValueOnce();

    const actual: TestHashOnlyItem[] = await testHashOnly.scan(scanInput, ttl);
    const cacheKeyItemMap: CacheKeyItemMap<TestHashOnlyItem> = buildItemsCacheMap(
      CACHE_PREFIX_KEY,
      testHashOnly.tableName,
      testHashOnly.tableKeySchema,
      actual
    );

    expect(actual).toEqual(items);
    expect(dynamodbCacheSetItemsInCacheMock).toBeCalledWith(cacheKeyItemMap, ttl);
  });

  it('scan should return an empty list. setItemsInCache should not be invoked', async () => {
    const scanInput: DynamoDB.DocumentClient.ScanInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
    };
    const ttl = 30;

    const actual: TestHashOnlyItem[] = await testHashOnly.scan(scanInput, ttl);

    expect(actual).toEqual([]);
    expect(dynamodbCacheSetItemsInCacheMock).not.toBeCalled();
  });

  it('scan should return a list of TestHashOnlyItem records but not add items to cache because of no ttl', async () => {
    const scanInput: DynamoDB.DocumentClient.ScanInput = {
      TableName: testHashOnly.tableName,
      ConsistentRead: true,
    };

    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: testHashOnlyItem,
      })
      .promise();

    const actual: TestHashOnlyItem[] = await testHashOnly.scan(scanInput);

    expect(actual).toEqual(items);
    expect(dynamodbCacheSetItemsInCacheMock).not.toBeCalled();
  });

  it('should put the item and store it in the cache', async () => {
    const item2: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing2',
    };
    const ttl = 30;
    const cacheKey = `${CACHE_PREFIX_KEY}${testHashOnly.tableName}:id-testId2`;

    dynamodbCacheSetInCacheMock.mockResolvedValueOnce();

    const input2: DocumentClient.PutItemInput = {
      TableName: testHashOnly.tableName,
      Item: item2,
    };

    const actual: TestHashOnlyItem = await testHashOnly.put(input2, ttl);
    const { Item } = await testHashOnly.dynamoDbDocClient
      .get({
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId2',
        },
      })
      .promise();

    expect(actual).toEqual(item2);
    expect(Item).toBeDefined();
    expect(actual).toEqual(Item);
    expect(dynamodbCacheSetInCacheMock).toBeCalledWith(cacheKey, actual, ttl);

    await testHashOnly.dynamoDbDocClient
      .delete({
        TableName: testHashOnly.tableName,
        Key: { id: 'testId2' },
      })
      .promise();
  });

  it('should put the item and not store it in the cache because the ttl is null', async () => {
    const item3: TestHashOnlyItem = {
      id: 'testId3',
      test: 'testing3',
    };

    const input3: DocumentClient.PutItemInput = {
      TableName: testHashOnly.tableName,
      Item: item3,
    };

    const actual: TestHashOnlyItem = await testHashOnly.put(input3);
    const { Item } = await testHashOnly.dynamoDbDocClient
      .get({
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId3',
        },
      })
      .promise();

    expect(actual).toEqual(item3);
    expect(Item).toBeDefined();
    expect(actual).toEqual(Item);
    expect(dynamodbCacheSetInCacheMock).not.toBeCalled();

    await testHashOnly.dynamoDbDocClient
      .delete({
        TableName: testHashOnly.tableName,
        Key: { id: 'testId3' },
      })
      .promise();
  });

  it('should update the item in the table and store it in the cache', async () => {
    const item2: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing2',
    };
    const itemUpdated: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing_updated',
    };
    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: item2,
      })
      .promise();

    const givenKey: DynamoDB.DocumentClient.Key = { id: 'testId2' };
    const givenUpdateExpression: DynamoDB.DocumentClient.UpdateExpression = 'SET #test = :test';
    const givenExpressionAttributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap = { '#test': 'test' };
    const givenExpressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':test': 'testing_updated',
    };
    const ttl = 30;
    const cacheKey = `${CACHE_PREFIX_KEY}${testHashOnly.tableName}:id-testId2`;

    dynamodbCacheSetInCacheMock.mockResolvedValueOnce();

    const actual = await testHashOnly.update(
      {
        TableName: testHashOnly.tableName,
        Key: givenKey,
        ReturnValues: 'ALL_NEW',
        UpdateExpression: givenUpdateExpression,
        ExpressionAttributeNames: givenExpressionAttributeNames,
        ExpressionAttributeValues: givenExpressionAttributeValues,
      },
      ttl
    );
    const { Item } = await testHashOnly.dynamoDbDocClient
      .get({
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId2',
        },
      })
      .promise();

    expect(actual).toEqual(itemUpdated);
    expect(Item).toBeDefined();
    expect(actual).toEqual(Item);
    expect(dynamodbCacheSetInCacheMock).toBeCalledWith(cacheKey, actual, ttl);

    await testHashOnly.dynamoDbDocClient
      .delete({
        TableName: testHashOnly.tableName,
        Key: { id: 'testId2' },
      })
      .promise();
  });

  it('should update the item in the table and not set the item in the cache - no ttl passed in', async () => {
    const item2: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing2',
    };
    const itemUpdated: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing_updated',
    };
    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: item2,
      })
      .promise();

    const givenKey: DynamoDB.DocumentClient.Key = { id: 'testId2' };
    const givenUpdateExpression: DynamoDB.DocumentClient.UpdateExpression = 'SET #test = :test';
    const givenExpressionAttributeNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap = { '#test': 'test' };
    const givenExpressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
      ':test': 'testing_updated',
    };

    const actual = await testHashOnly.update({
      TableName: testHashOnly.tableName,
      Key: givenKey,
      ReturnValues: 'ALL_NEW',
      UpdateExpression: givenUpdateExpression,
      ExpressionAttributeNames: givenExpressionAttributeNames,
      ExpressionAttributeValues: givenExpressionAttributeValues,
    });
    const { Item } = await testHashOnly.dynamoDbDocClient
      .get({
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'testId2',
        },
      })
      .promise();

    expect(actual).toEqual(itemUpdated);
    expect(Item).toBeDefined();
    expect(actual).toEqual(Item);
    expect(dynamodbCacheSetInCacheMock).not.toBeCalled();

    await testHashOnly.dynamoDbDocClient
      .delete({
        TableName: testHashOnly.tableName,
        Key: { id: 'testId2' },
      })
      .promise();
  });

  it('should delete the item from the table', async () => {
    const dynamodbCacheRemoveItemFromCacheMock = jest.spyOn(testHashOnly.dynamodbCache, 'removeItemFromCache');

    const itemToDelete: TestHashOnlyItem = {
      id: 'delete_me',
      test: 'gonna be deleted',
    };
    await testHashOnly.dynamoDbDocClient
      .put({
        TableName: testHashOnly.tableName,
        Item: itemToDelete,
      })
      .promise();

    const givenKey: DynamoDB.DocumentClient.Key = { id: 'delete_me' };

    dynamodbCacheRemoveItemFromCacheMock.mockResolvedValueOnce();

    await testHashOnly.delete({ TableName: testHashOnly.tableName, Key: givenKey });

    const { Item } = await testHashOnly.dynamoDbDocClient
      .get({
        TableName: testHashOnly.tableName,
        ConsistentRead: true,
        Key: {
          id: 'delete_me',
        },
      })
      .promise();

    expect(Item).not.toBeDefined();
    expect(dynamodbCacheRemoveItemFromCacheMock).toBeCalledWith(testHashOnly.tableName, givenKey);
  });
});
