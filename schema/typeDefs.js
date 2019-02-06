const Price = `
  type Price {
    currency: String
    value: Int
  }
`

const Transaction = `
  type Transaction {
    key: ID!
    provider: User!
    receiver: User!
    affectedQuantity: Price!
    affects: [Resource]
  }
`

const User = `
  type User {
    username: ID!
    balance: [Price]
    publishedResources: [Resource]
    transactions: [Transaction]
  }
`

const Resource = `
  type Resource {
    key: ID!
    category: String!
    prices: [Price]
    user: String!
  }
`

const Query = `
  type Query {
    publishedResources: [Resource]
    user(username: String!): User
    transactions: [Transaction]
  }
`

const Mutation = `
  input ResourceInput {
    category: String!
    owner: String!
    prices: [String]
  }
  input TransactionInput {
    provider: String!
    receiver: String!
    currency: String!
    value: Int!
    affects: [String]
  }
  type Mutation {
    publishResource(input: ResourceInput): Resource
    unpublishResource(id: String!): Resource
    transaction(input: TransactionInput): Transaction
  }
`
const Schema = () => [`
  schema {
    query: Query
    mutation: Mutation
  }
`]

module.exports = [
  Schema,
  Query,
  Mutation,
  Resource,
  User,
  Transaction,
  Price,
]