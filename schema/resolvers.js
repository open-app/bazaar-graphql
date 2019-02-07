const { 
  // getId,
  getAbout,
  // getBlob,
  publish,
  message,
  getMessagesByType,
  get,
} = require('ssb-helpers')

const resourceClassficationType = 'vf:resourceClassificationAlpha'
const economicResourceType = 'vf:economicResourceAlpha'
const economicEventType = 'vf:economicEventAlpha'
const unpublishAction = "unpublish resource"
const transactionAction = "transaction"

function sum(obj, src) {
  Object.keys(src).forEach((key) => {
    if (obj[key]) {
      obj[key] = obj[key] + src[key]
    } else obj[key] = src[key]
  })
  return obj
}

const getResourceClassfication = async (id, sbot) => {
  const resourceClassification = await message({ id }, sbot)
  return Object.assign({ key: resourceClassification.key }, resourceClassification.value.content)
}

const getPrices = (prices) => prices.map(price => {
  const i = price.split(',')
  return {
    value: i[0],
    currency: i[1]
  }
})

const getTransactions = async (sbot) => {
  const events = await getMessagesByType({ type: economicEventType }, sbot)
  return events.filter(event => event.value.content.action === transactionAction)

}

const getEconomicResource = async (id, sbot) => {
  const economicResource = await message({ id }, sbot)
  const resourceClassifiedAs = await getResourceClassfication(economicResource.value.content.resourceClassifiedAs, sbot)
  const prices = getPrices(economicResource.value.content.prices)
  return Object.assign(
    economicResource.value.content,
    {key: id, resourceClassifiedAs, prices},
  )
}

const getUserBalance = async(username, sbot) => {
  const transactions = await getUserTransactions(username, sbot)
  const userReceived = transactions
    .filter(transaction => transaction.value.content.receiver === username)
    .reduce((accumulator, currentValue) => {
      currentValue.value.content.affectedQuantity
        .map(price => {
          const c = price.split(',')[1]
          const value = parseInt(price.split(',')[0])
          let currentValue = accumulator[c]
          if (currentValue) {
            return Object.assign(accumulator, { [c]: currentValue + value })
          }
          return Object.assign(accumulator, { [c]: value })
        })
      return accumulator
    }, {})
  const userProvided = transactions
    .filter(transaction => transaction.value.content.provider === username)
    .reduce((accumulator, currentValue) => {
      currentValue.value.content.affectedQuantity
        .map(price => {
          const c = price.split(',')[1]
          const value = parseInt(price.split(',')[0])
          let currentValue = accumulator[c]
          if (currentValue) {
            return Object.assign(accumulator, { [c]: currentValue - value })
          }
          return Object.assign(accumulator, { [c]: -value })
        })
      return accumulator
    }, {})
    const balanced = sum(userReceived, userProvided)
    const formated = Object.keys(balanced).map(key => `${balanced[key]},${key}`)
    return getPrices(formated)
}

const getPublishedResources = async (sbot) => {
  try {
    const events = await getMessagesByType({ type: economicEventType }, sbot)
    const unpublished = events
      .filter(msg => msg.value.content.action === unpublishAction)
      .map(msg => msg.value.content.affects[0])
    // console.log('unpublished', unpublished)
    const msgs = await getMessagesByType({ type: economicResourceType }, sbot)
    // console.log('MSGS', msgs)
    const filtered = msgs
      .filter(msg => msg.value.content.prices.length > 0)
      .filter(msg => {
        let isUnpublished
        unpublished.map(un => {
          if (msg.key === un) isUnpublished = true
        })
        if (isUnpublished) return false
        return true
      })
    const res = await filtered
      .map(async (msg) => {
        // console.log('MSG', Object.keys(msg).length)
        const resourceClassifiedAs = await getResourceClassfication(msg.value.content.resourceClassifiedAs, sbot)
        const prices = getPrices(msg.value.content.prices)
        // console.log('ASYNC')
        return {
          key: msg.key,
          category: resourceClassifiedAs.category,
          prices,
          user: msg.value.content.currentOwner,
        }
      })
    // console.log('ASONC')
    return res
  } catch(err) {
    console.log('ERROR!!', err)
  }
}

const getUserPublications = async(username, sbot) => {
  const resources = await getPublishedResources(sbot)
  return resources.filter(r => r.user === username)
}

const getUserTransactions = async(username, sbot) => {
  const transactions = await getTransactions(sbot)
  return transactions.filter(transaction => (transaction.value.content.receiver === username || transaction.value.content.provider === username))
}

const getUser = async(username, sbot) => {
  const balance = await getUserBalance(username, sbot)
  const transactions = await getUserTransactions(username, sbot)
  const publishedResources = await getUserPublications(username, sbot)
  const res = {
    username,
    balance,
    transactions,
    publishedResources,
  }
  return res
}

const Query = {
  publishedResources: async (_, {}, { sbot }) => {
    return await getPublishedResources(sbot)
  },
  user: async(_, { username }, { sbot }) => {
    return getUser(username, sbot)
  },
  transactions: async(_, {}, {sbot}) => {
    const events = await getMessagesByType({ type: economicEventType }, sbot)
    const transactions = events.filter(event => event.value.content.action === transactionAction)
    return transactions.map(tx => Object.assign(tx.value.content, { key: tx.key }))
  }
}

const Mutation = {
  publishResource: async (_, { input }, { sbot }) => {
    const classification = await publish(Object.assign({ type: resourceClassficationType }, {
      category: input.category
    }), sbot)
      .then(msg => Object.assign({ key: msg.key }, msg.value.content ))
    const prices = getPrices(input.prices)
    return publish(Object.assign({ type: economicResourceType,  createdDate: new Date() }, {
      currentOwner: input.owner,
      prices: input.prices,
      resourceClassifiedAs: classification.key
    }), sbot)
      .then(msg => {
        return {
          key: msg.key,
          category: classification.category,
          prices,
          user: msg.value.content.currentOwner,
        }
      })

  },
  unpublishResource: async (_, { id }, { sbot }) => {
    const affectedResource = await getEconomicResource(id, sbot)
    return publish(Object.assign({ type: economicEventType, affects: [ affectedResource.key ], action: unpublishAction }), sbot)
      .then(msg => {
        return {
          key: msg.key,
          category: affectedResource.resourceClassifiedAs.category,
          prices: affectedResource.prices,
          user: affectedResource.currentOwner,
        }
      })
  },
  transaction: async(_, { input: { provider, receiver, currency, value, affects }}, { sbot }) => {
    return publish({
      type: economicEventType,
      affects: affects,
      action: transactionAction,
      provider,
      receiver,
      affectedQuantity: [`${value},${currency}`]
    }, sbot)
      .then(msg => {
        return {
          key: msg.key,
          provider: getUser(msg.value.content.provider, sbot),
          receiver: getUser(msg.value.content.receiver, sbot),
          affectedQuantity: [ { currency, value }],
        }
      })
  },
}

module.exports = {Query, Mutation}
