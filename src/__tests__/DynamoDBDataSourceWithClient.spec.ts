import { DataSourceConfig } from 'apollo-datasource';
import { DynamoDB } from 'aws-sdk';

import { DynamoDBDataSource } from '../DynamoDBDataSource';

const { MOCK_DYNAMODB_ENDPOINT } = process.env;

interface TestItem {
  id: string;
  item1: string;
  item2: string;
}

class TestWithClient extends DynamoDBDataSource<TestItem> {
  constructor(tableName: string, tableKeySchema: DynamoDB.DocumentClient.KeySchema, client: DynamoDB.DocumentClient) {
    super(tableName, tableKeySchema, null, client);
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

const client: DynamoDB.DocumentClient = new DynamoDB.DocumentClient({
  apiVersion: 'latest',
  region: 'local',
  endpoint: MOCK_DYNAMODB_ENDPOINT,
  sslEnabled: false,
});

const testWithClient = new TestWithClient('test_with_client', keySchema, client);
testWithClient.initialize({ context: {}, cache: null });

const testItem: TestItem = {
  id: 'testWithClientId',
  item1: 'testing1',
  item2: 'testing2',
};

beforeAll(async () => {
  await testWithClient.dynamoDbDocClient
    .put({
      TableName: testWithClient.tableName,
      Item: testItem,
    })
    .promise();
});

afterAll(async () => {
  await testWithClient.dynamoDbDocClient
    .delete({
      TableName: testWithClient.tableName,
      Key: { id: 'testWithClientId' },
    })
    .promise();
});

describe('DynamoDBDataSource With Initialized Client', () => {
  it('initializes a new TestHashOnly and instantiates props', () => {
    expect(testWithClient.dynamoDbDocClient).toBeDefined();
    expect(testWithClient.dynamoDbDocClient).toEqual(client);
    expect(testWithClient.tableName).toBeDefined();
    expect(testWithClient.tableKeySchema).toBeDefined();
    expect(testWithClient.dynamodbCache).toBeDefined();
  });
});
