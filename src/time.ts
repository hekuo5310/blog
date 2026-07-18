const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000

export function parseDatabaseUtc(value: string): Date {
  const trimmed = value.trim()
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  return new Date(trimmed.replace(' ', 'T') + (hasTimeZone ? '' : 'Z'))
}

function shiftedUtc8(value: string): Date | null {
  const date = parseDatabaseUtc(value)
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() + UTC8_OFFSET_MS)
}

export function formatUtc8Date(value: string): string {
  return shiftedUtc8(value)?.toISOString().slice(0, 10) ?? value.slice(0, 10)
}

export function formatUtc8DateTime(value: string): string {
  return shiftedUtc8(value)?.toISOString().slice(0, 19).replace('T', ' ') ?? value
}

export function databaseUtcToIso(value: string): string {
  const date = parseDatabaseUtc(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export function currentUtc8Year(): number {
  return new Date(Date.now() + UTC8_OFFSET_MS).getUTCFullYear()
}
