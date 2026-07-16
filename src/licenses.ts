export const DEFAULT_ARTICLE_LICENSE = 'CC BY 4.0'

export const ARTICLE_LICENSES = [
  { value: 'CC BY 4.0', label: 'CC BY 4.0（署名）', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { value: 'CC BY-SA 4.0', label: 'CC BY-SA 4.0（署名-相同方式共享）', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { value: 'CC BY-NC 4.0', label: 'CC BY-NC 4.0（署名-非商业性使用）', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  { value: 'CC BY-NC-SA 4.0', label: 'CC BY-NC-SA 4.0（署名-非商业性使用-相同方式共享）', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  { value: 'CC BY-ND 4.0', label: 'CC BY-ND 4.0（署名-禁止演绎）', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  { value: 'CC BY-NC-ND 4.0', label: 'CC BY-NC-ND 4.0（署名-非商业性使用-禁止演绎）', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
  { value: 'CC0 1.0', label: 'CC0 1.0（公共领域贡献）', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { value: 'All rights reserved', label: '保留所有权利', url: null }
] as const

export function normalizeArticleLicense(value: unknown): string {
  return ARTICLE_LICENSES.some(license => license.value === value) ? String(value) : DEFAULT_ARTICLE_LICENSE
}

export function getArticleLicense(value: unknown) {
  const normalized = normalizeArticleLicense(value)
  return ARTICLE_LICENSES.find(license => license.value === normalized) ?? ARTICLE_LICENSES[0]
}
