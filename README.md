# Apollo DynamoDB Data Source

**This package is forked from https://github.com/cmwhited/apollo-datasource-dynamodb and has gone through major update**

This package exports a ([`DynamoDBDataSource`](https://github.com/cmwhited/apollo-datasource-dynamodb/blob/master/src/DynamoDBDataSource.ts)) class which is used for fetching data from a DynamoDB Table and exposing it via GraphQL within Apollo Server.

## Documentation

View the [Apollo Server documentation for data sources](https://www.apollographql.com/docs/apollo-server/features/data-sources/) for more details.

## Usage

To get started, install the `apollo-datasource-dynamodb` package

```bash
# with npm
npm install --save apollo-datasource-dynamodb
# with yarn
yarn add apollo-datasource-dynamodb
```

To define a data source, extend the `DynamoDBDataSource` class and pass in the name of the table, the Key schema, and the `ClientConfiguration` that allows the lib to connect to the `DynamoDB.DocumentClient` to interact with data in the table. Creating an instance of this class then allows you to utilize the API methods.

### Example

Say you have a DynamoDB table called `test_data` which has a `Schema`:

```ts
{
  TableName: 'test_hash_only',
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
}
```

Here is an example interface of the items that will be returned from this table:

```ts
interface TestHashOnlyItem {
  id: string;
  test: string;
}
```

To use the `DynamoDBDataSource` we create a class that subclasses this Data Source and can then implement API:

```ts
// ./src/data-sources/test-hash-only.datasource.ts

import { DynamoDBDataSource } from 'apollo-datasource-dynamodb';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

class TestHashOnly extends DynamoDBDataSource<TestHashOnlyItem> {
  private readonly tableName = 'test_hash_only';
  private readonly tableKeySchema: DocumentClient.KeySchema = [
    {
      AttributeName: 'id',
      KeyType: 'HASH',
    },
  ];
  private readonly ttl = 30 * 60; // 30minutes

  constructor(config?: ClientConfiguration) {
    super(this.tableName, this.tableKeySchema, config);
  }

  async getTestHashOnlyItem(id: string): Promise<TestHashOnlyItem> {
    const getItemInput: DocumentClient.GetItemInput = {
      TableName: this.tableName,
      ConsistentRead: true,
      Key: { id },
    };
    return this.getItem(getItemInput, this.ttl);
  }

  async scanForTestHashOnlyItems(): Promise<TestHashOnlyItem[]> {
    const scanInput: DocumentClient.ScanInput = {
      TableName: this.tableName,
      ConsistentRead: true,
    };
    return this.scan(scanInput, this.ttl);
  }
}
```

And then to utilize this instance as a data source in the `ApolloServer` instance:

```ts
// ./src/server.ts

import { ApolloServer } from 'apollo-server-lambda';
import { TestHashOnly } from './data-sources/test-hash-only.datasource';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    testHashOnly: new TestHashOnly(),
  }),
});
```

The to use the use the `TestHashOnly` data source in the resolvers:

```ts
// ./src/schema.ts

import { gql, IResolvers } from 'apollo-server-lambda';
import { DocumentNode } from 'graphql';

export const typeDefs: DocumentNode = gql`
  type TestHashOnlyItem {
    id: String!
    test: String!
  }

  type Query {
    getTestHashOnlyItem(id: String!): TestHashOnlyItem
    scanHashOnlyItems: [TestHashOnlyItem]
  }
`;

export const resolvers: IResolvers = {
  Query: {
    getTestHashOnlyItem: async (_source, { id }, { dataSources }) => dataSources.testHashOnly.getTestHashOnlyItem(id),
    scanHashOnlyItems: async (_source, _params, { dataSources }) => dataSources.testHashOnly.scanForTestHashOnlyItems(),
  },
};
```

#### v1.1.0+ Example With Initialized Client

As of `v1.1.0+`, another optional parameter was added to the `DynamoDBDataSource` class constructor that accepts an intialized `DynamoDB.DocumentClient` instance and uses this instance in the class instead of initializing a new one.

Here is an example of how to use this param with a class that extends the `DynamoDBDataSource`:

```ts
// ./src/data-sources/test-with-client.datasource.ts

import { DynamoDBDataSource } from 'apollo-datasource-dynamodb';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

class TestWithClient extends DynamoDBDataSource<TestItem> {
  private readonly tableName = 'test_with_client';
  private readonly tableKeySchema: DocumentClient.KeySchema = [
    {
      AttributeName: 'id',
      KeyType: 'HASH',
    },
  ];
  private readonly ttl = 30 * 60; // 30minutes

  constructor(client: DocumentClient) {
    super(this.tableName, this.tableKeySchema, null, client);
  }

  async getTestHashOnlyItem(id: string): Promise<TestHashOnlyItem> {
    const getItemInput: DocumentClient.GetItemInput = {
      TableName: this.tableName,
      ConsistentRead: true,
      Key: { id },
    };
    return this.getItem(getItemInput, this.ttl);
  }

  async scanForTestHashOnlyItems(): Promise<TestHashOnlyItem[]> {
    const scanInput: DocumentClient.ScanInput = {
      TableName: this.tableName,
      ConsistentRead: true,
    };
    return this.scan(scanInput, this.ttl);
  }
}
```

And then to utilize this instance as a data source in the `ApolloServer` instance:

```ts
// ./src/server.ts

import { ApolloServer } from 'apollo-server-lambda';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

import { TestWithClient } from './data-sources/test-with-client.datasource';

const client: DocumentClient = new DocumentClient({
  apiVersion: 'latest',
  region: 'us-east-1',
});

const testWithClient = new TestWithClient(client);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    testWithClient,
  }),
});
```

This paramater was added to allow for use of the library with already initialized `DynamoDB.DocumentClient` instances for use with dependency injection, etc.

## API

### getItem

`this.getItem(getItemInput, 180)`

Returns a single instance of the item being retrieved from the table by the key value. It checks the cache for the record, if the value is found in the cache, it returns the item, otherwise it uses the `DynamoDB.DocumentClient.get` method to retrieve the item from the table; if a record is found in the table, it is then added to the cache with the passed in `ttl`.

[DynamoDB.DocumentClient.get](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property)

#### getItem Example

```ts
const getItemInput: DocumentClient.GetItemInput = {
  TableName: 'test_hash_only',
  ConsistentRead: true,
  Key: {
    id: 'testId',
  },
};
const ttl = 30 * 60; // 30minutes

const item: TestHashOnlyItem = await this.getItem(getItemInput, ttl);
```

### query

`this.query(queryInput, 180)`

Returns all records from the table found by the query. If the `ttl` is provided, it adds all of the items to the cache.

[DynamoDB.DocumentClient.query](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#query-property)

#### query Example

```ts
const queryInput: DynamoDB.DocumentClient.QueryInput = {
  TableName: 'test_hash_only',
  ConsistentRead: true,
  KeyConditionExpression: 'id = :id',
  ExpressionAttributeValues: {
    ':id': 'testId',
  },
};
const ttl = 30 * 60; // 30minutes

const items: TestHashOnlyItem[] = await this.query(queryInput, ttl);
```

### scan

`this.scan(scanInput, 180)`

Returns all scanned records from the table by the `scanInput`. A scan is different from a query because in a `query` a portion of the key schema on the table must be provided. A `scan` allows you to retrieve all items from the table, it also lets you paginate.

[DynamoDB.DocumentClient.scan](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#scan-property)

#### scan Example

```ts
const scanInput: DynamoDB.DocumentClient.ScanInput = {
  TableName: 'test_hash_only',
  ConsistentRead: true,
};
const ttl = 30 * 60; // 30minutes

const items: TestHashOnlyItem[] = await this.scan(scanInput, ttl);
```

### put

`this.put(putItemInput, 180)`

Saves the given item in the putItemInput to the table. If a `ttl` value is provided it will also add the item to the cache

[DynamoDB.DocumentClient.put](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#put-property)

#### put Example

```ts
const item: TestHashOnlyItem = {
      id: 'testId2',
      test: 'testing2',
    };
const ttl = 30 * 60; // 30minutes

const putItemInput: DocumentClient.PutItemInput = {
  TableName: testHashOnly.tableName,
  Item: item,
  ConditionExpression: 'id <> :value',
  ExpressionAttributeValues: {
    ':value': 'testing'
  },
  ReturnValues: 'NONE',
};

const created: TestHashOnlyItem = await testHashOnly.put(putItemInput, ttl);
```

### update

`this.update(key, updateExpression, expressionAttributeNames, expressionAttributeValues, 180)`

Updates the item in the table found by the given key and then uses the update expressions to update the record in the table. These input values are used to build a `DocumentClient.UpdateItemInput` instance to tells DynamoDB how to update the record.

[DynamoDB.DocumentClient.update](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#update-property)

#### update Example

```ts
const key: DocumentClient.Key = {
  id: 'testId',
};
const updateExpression: DocumentClient.UpdateExpression = 'SET #test = :test';
const expressionAttributeNames: DocumentClient.ExpressionAttributeNameMap = { '#test': 'test' };
const expressionAttributeValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {
  ':test': 'testing_updated',
};
const ttl = 30 * 60; // 30minutes

const updated: TestHashOnlyItem = await this.update(
  key,
  updateExpression,
  expressionAttributeNames,
  expressionAttributeValues,
  ttl
);
```

### delete

`this.delete(key)`

Deletes the item found by the key from the table. It also evicts the item from the cache.

[DynamoDB.DocumentClient.delete](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#delete-property)

#### delete Example

```ts
const key: DocumentClient.Key = {
  id: 'testId',
};

await this.delete(key);
```
