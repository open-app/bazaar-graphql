const { 
  // getId,
  getAbout,
  // getBlob,
  publish,
  message,
  getMessagesByType,
  get,
} = require('ssb-helpers')

const resourceClassficationTypeCurrency = 'resourceClassificationTest3:currency'
const economicResourceType = 'economicResourceTest3'
const economicEventType = 'economicEventTest3'
const unpublishAction = "unpublish resource"

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

const getEconomicResource = async (id, sbot) => {
  const economicResource = await message({ id }, sbot)
  const resourceClassifiedAs = await getResourceClassfication(economicResource.value.content.resourceClassifiedAs, sbot)
  const prices = getPrices(economicResource.value.content.prices)
  return Object.assign(
    economicResource.value.content,
    {key: id, resourceClassifiedAs, prices},
  )
}

const Query = {
  publishedResources: async (_, {}, { sbot }) => {
    const events = await getMessagesByType({ type: economicEventType }, sbot)
    const unpublished = events
      .filter(msg => msg.value.content.action === unpublishAction)
      .map(msg => msg.value.content.affects[0])
    const msgs = await getMessagesByType({ type: economicResourceType }, sbot)
    return msgs
      .filter(msg => msg.value.content.prices.length > 0)
      .filter(msg => {
        let isUnpublished
        unpublished.map(un => {
          if (msg.key === un) isUnpublished = true
        })
        if (isUnpublished) return false
        return true
      })
      .map(async msg => {
        const resourceClassifiedAs = await getResourceClassfication(msg.value.content.resourceClassifiedAs, sbot)
        const prices = getPrices(msg.value.content.prices)
        return {
          key: msg.key,
          category: resourceClassifiedAs.category,
          prices,
          user: msg.value.content.currentOwner,
        }
      })
  },
}

const Mutation = {
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
}

module.exports = {Query, Mutation}
