import * as car from '@ipld/car'
import * as dagCbor from "@ipld/dag-cbor"
import * as Block from "multiformats/block"
import { sha256 } from 'multiformats/hashes/sha2'

export async function decodeCarToJson(data: Uint8Array) {
  const decoder = await car.CarReader.fromBytes(data)
  const blocks = []

  for await (const block of decoder.blocks()) {
    try {
      const decoded = dagCbor.decode(block.bytes)
      blocks.push({
        cid: block.cid.toString(),
        data: decoded
      })
    } catch (error) {
      // just incase we have blocks that are not CBOR-encoded
      blocks.push({
        cid: block.cid.toString(),
        data: {
          bytes: [...block.bytes]
        }
      })
      console.error(`${(error as Error).message}`)
    }
  }

  return blocks
}
