import { DynamoDB } from 'aws-sdk';

import { CacheKeyItemMap } from '../types';
import { buildCacheKey, buildItemsCacheMap, buildKey } from '../utils';

interface TestItem {
  id: string;
  timestamp: string;
  test: string;
}

describe('buildCacheKey', () => {
  it('should return build cache key from the given table and single HASH key value', () => {
    const givenCachePrefix = 'test:';
    const givenTableName = 'test';
    const givenKey: DynamoDB.DocumentClient.Key = {
      id: 'testId',
    };
    const expected = 'test:test:id-testId';

    const actual = buildCacheKey(givenCachePrefix, givenTableName, givenKey);

    expect(actual).toEqual(expected);
  });
  it('should return build cache key from the given table and compose HASH and RANGE key values', () => {
    const givenCachePrefix = 'test:';
    const givenTableName = 'test';
    const givenKey: DynamoDB.DocumentClient.Key = {
      id: 'testId',
      timestamp: '2020-01-01 00:00:00',
    };
    const expected = 'test:test:id-testId:timestamp-2020-01-01 00:00:00';

    const actual = buildCacheKey(givenCachePrefix, givenTableName, givenKey);

    expect(actual).toEqual(expected);
  });
});

describe('buildItemsCacheMap', () => {
  it('should build the CacheItemKeyMap with single HASH key', () => {
    const givenCachePrefix = 'test:';
    const givenTableName = 'test';
    const givenKeySchema: DynamoDB.DocumentClient.KeySchema = [
      {
        AttributeName: 'id',
        KeyType: 'HASH',
      },
    ];
    const givenItems: TestItem[] = [
      {
        id: 'testId',
        timestamp: '2020-01-01 00:00:00',
        test: 'testing',
      },
    ];
    const expected: CacheKeyItemMap<TestItem> = {
      ['test:test:id-testId']: {
        id: 'testId',
        timestamp: '2020-01-01 00:00:00',
        test: 'testing',
      },
    };

    const actual = buildItemsCacheMap<TestItem>(givenCachePrefix, givenTableName, givenKeySchema, givenItems);

    expect(actual).toEqual(expected);
  });

  it('should build the CacheItemKeyMap with a HASH and RANGE composite key', () => {
    const givenCachePrefix = 'test:';
    const givenTableName = 'test';
    const givenKeySchema: DynamoDB.DocumentClient.KeySchema = [
      {
        AttributeName: 'id',
        KeyType: 'HASH',
      },
      {
        AttributeName: 'timestamp',
        KeyType: 'RANGE',
      },
    ];
    const givenItems: TestItem[] = [
      {
        id: 'testId',
        timestamp: '2020-01-01 00:00:00',
        test: 'testing',
      },
    ];
    const expected: CacheKeyItemMap<TestItem> = {
      ['test:test:id-testId:timestamp-2020-01-01 00:00:00']: {
        id: 'testId',
        timestamp: '2020-01-01 00:00:00',
        test: 'testing',
      },
    };

    const actual = buildItemsCacheMap<TestItem>(givenCachePrefix, givenTableName, givenKeySchema, givenItems);

    expect(actual).toEqual(expected);
  });
});

describe('buildKey', () => {
  it('should build a key with only a HASH key', () => {
    const givenKeySchema: DynamoDB.DocumentClient.KeySchema = [
      {
        AttributeName: 'id',
        KeyType: 'HASH',
      },
    ];
    const givenItem: TestItem = {
      id: 'testId',
      timestamp: '2020-01-01 00:00:00',
      test: 'testing',
    };
    const expected: DynamoDB.DocumentClient.Key = {
      id: 'testId',
    };

    const actual = buildKey(givenKeySchema, givenItem);

    expect(actual).toEqual(expected);
  });

  it('should build a key with a HASH and RANGE key', () => {
    const givenKeySchema: DynamoDB.DocumentClient.KeySchema = [
      {
        AttributeName: 'id',
        KeyType: 'HASH',
      },
      {
        AttributeName: 'timestamp',
        KeyType: 'RANGE',
      },
    ];
    const givenItem: TestItem = {
      id: 'testId',
      timestamp: '2020-01-01 00:00:00',
      test: 'testing',
    };
    const expected: DynamoDB.DocumentClient.Key = {
      id: 'testId',
      timestamp: '2020-01-01 00:00:00',
    };

    const actual = buildKey(givenKeySchema, givenItem);

    expect(actual).toEqual(expected);
  });
});
