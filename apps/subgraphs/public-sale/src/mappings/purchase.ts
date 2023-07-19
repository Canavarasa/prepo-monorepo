import { Purchase as PurchaseEvent } from '../generated/types/MiniSales/MiniSales'
import { Participant, Purchase } from '../generated/types/schema'
import { ZERO_BI } from '../utils/constants'

function newParticipant(id: string): Participant {
  const participant = new Participant(id)
  participant.amount = ZERO_BI
  return participant
}

export function handlePurchase(event: PurchaseEvent): void {
  const address = event.params.recipient.toHex()
  const txHash = event.transaction.hash.toHexString()

  // store each purchase event
  const purchase = new Purchase(txHash)
  purchase.purchaser = event.params.purchaser.toHexString()
  purchase.recipient = event.params.recipient.toHexString()
  purchase.amount = event.params.amount
  purchase.price = event.params.price
  purchase.timestamp = event.block.timestamp
  purchase.save()

  // aggregate total purchase amount by purchaser
  let participant = Participant.load(address)
  if (participant === null) participant = newParticipant(address)

  participant.amount = participant.amount.plus(event.params.amount)
  participant.save()
}
