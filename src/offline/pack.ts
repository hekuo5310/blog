export type ArchiveEntry = { path: string; type: string; body: string; base64?: boolean }
export class ArchiveSizeError extends Error {}
// Size of JSON string contents (excluding quotes), without allocating an escaped copy.
function escapedBytes(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 34 || code === 92) bytes += 2
    else if (code < 32) bytes += [8, 9, 10, 12, 13].includes(code) ? 2 : 6
    else if (code < 128) bytes++
    else if (code < 2048) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++ }
      else bytes += 6 // JSON.stringify escapes lone surrogates.
    } else bytes += code >= 0xdc00 && code <= 0xdfff ? 6 : 3
  }
  return bytes
}
/** Retain only serialized entries; gzip consumes them without a second whole-pack JSON copy. */
export class ArchivePack {
  private entries: string[] = []
  private encoder = new TextEncoder()
  private header: string
  bytes: number
  constructor(version: string, private limit = 32 * 1024 * 1024) {
    this.header = '{"version":' + JSON.stringify(version) + ',"entries":['
    this.bytes = this.encoder.encode(this.header + ']}').length
    this.ensureCapacity(0)
  }
  ensureCapacity(additionalBytes: number) {
    if (this.bytes + additionalBytes > this.limit) throw new ArchiveSizeError('离线包编码后超过 32 MiB 上限')
  }
  /** Reserve Base64's exact character count and serialized entry overhead before reading an image. */
  checkImage(path: string, type: string, rawBytes: number) {
    const overhead = this.encoder.encode(JSON.stringify({ path, type, body: '', base64: true })).length
    this.ensureCapacity(overhead + 4 * Math.ceil(rawBytes / 3) + (this.entries.length ? 1 : 0))
  }
  add(entry: ArchiveEntry) {
    const overhead = this.encoder.encode(JSON.stringify({ ...entry, body: '' })).length
    const size = overhead + escapedBytes(entry.body) + (this.entries.length ? 1 : 0)
    // Check before JSON.stringify: control characters can expand sixfold.
    this.ensureCapacity(size)
    this.bytes += size
    this.entries.push(JSON.stringify(entry))
  }
  stream(): ReadableStream<Uint8Array> {
    let index = -1
    return new ReadableStream({
      pull: controller => {
        if (index === -1) { controller.enqueue(this.encoder.encode(this.header)); index = 0; return }
        if (index < this.entries.length) {
          controller.enqueue(this.encoder.encode((index ? ',' : '') + this.entries[index]))
          this.entries[index++] = '' // Release each serialized entry as compression consumes it.
          return
        }
        controller.enqueue(this.encoder.encode(']}')); controller.close()
      },
    })
  }
}
