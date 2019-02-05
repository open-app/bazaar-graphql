
const Resource = `
  type Price {
    currency: String
    value: Int
  }
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
  }
`

const Mutation = `
  type Mutation {
    unpublishResource(id: String!): Resource
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
  Resource
]