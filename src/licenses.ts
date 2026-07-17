export const DEFAULT_ARTICLE_LICENSE = 'CC BY 4.0'
export const CUSTOM_ARTICLE_LICENSE = 'CUSTOM'

export type ArticleLicenseGroup = 'creative-commons' | 'software' | 'other'
export type ArticleLicenseOption = {
  value: string
  label: string
  url: string | null
  group: ArticleLicenseGroup
}
export type ArticleLicenseInput = {
  license: string
  customName: string
  customText: string
}

const CC_VERSIONS = ['4.0', '3.0', '2.5', '2.0', '1.0']
const CC_VARIANTS = [
  { code: 'BY', slug: 'by', description: '署名' },
  { code: 'BY-SA', slug: 'by-sa', description: '署名-相同方式共享' },
  { code: 'BY-NC', slug: 'by-nc', description: '署名-非商业性使用' },
  { code: 'BY-NC-SA', slug: 'by-nc-sa', description: '署名-非商业性使用-相同方式共享' },
  { code: 'BY-ND', slug: 'by-nd', description: '署名-禁止演绎' },
  { code: 'BY-NC-ND', slug: 'by-nc-nd', description: '署名-非商业性使用-禁止演绎' }
]

export const CREATIVE_COMMONS_LICENSES: ArticleLicenseOption[] = CC_VERSIONS.flatMap(version =>
  CC_VARIANTS.map(variant => ({
    value: `CC ${variant.code} ${version}`,
    label: `CC ${variant.code} ${version}（${variant.description}）`,
    url: `https://creativecommons.org/licenses/${variant.slug}/${version}/`,
    group: 'creative-commons' as const
  }))
)

export const SOFTWARE_LICENSES: ArticleLicenseOption[] = [
  { value: 'MIT', label: 'MIT License', url: 'https://spdx.org/licenses/MIT.html', group: 'software' },
  { value: 'Apache-2.0', label: 'Apache License 2.0', url: 'https://spdx.org/licenses/Apache-2.0.html', group: 'software' },
  { value: 'BSD-2-Clause', label: 'BSD 2-Clause License', url: 'https://spdx.org/licenses/BSD-2-Clause.html', group: 'software' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause License', url: 'https://spdx.org/licenses/BSD-3-Clause.html', group: 'software' },
  { value: 'GPL-2.0-only', label: 'GNU GPL v2.0 only', url: 'https://spdx.org/licenses/GPL-2.0-only.html', group: 'software' },
  { value: 'GPL-2.0-or-later', label: 'GNU GPL v2.0 or later', url: 'https://spdx.org/licenses/GPL-2.0-or-later.html', group: 'software' },
  { value: 'GPL-3.0-only', label: 'GNU GPL v3.0 only', url: 'https://spdx.org/licenses/GPL-3.0-only.html', group: 'software' },
  { value: 'GPL-3.0-or-later', label: 'GNU GPL v3.0 or later', url: 'https://spdx.org/licenses/GPL-3.0-or-later.html', group: 'software' },
  { value: 'AGPL-3.0-only', label: 'GNU AGPL v3.0 only', url: 'https://spdx.org/licenses/AGPL-3.0-only.html', group: 'software' },
  { value: 'AGPL-3.0-or-later', label: 'GNU AGPL v3.0 or later', url: 'https://spdx.org/licenses/AGPL-3.0-or-later.html', group: 'software' },
  { value: 'LGPL-2.1-only', label: 'GNU LGPL v2.1 only', url: 'https://spdx.org/licenses/LGPL-2.1-only.html', group: 'software' },
  { value: 'LGPL-2.1-or-later', label: 'GNU LGPL v2.1 or later', url: 'https://spdx.org/licenses/LGPL-2.1-or-later.html', group: 'software' },
  { value: 'LGPL-3.0-only', label: 'GNU LGPL v3.0 only', url: 'https://spdx.org/licenses/LGPL-3.0-only.html', group: 'software' },
  { value: 'LGPL-3.0-or-later', label: 'GNU LGPL v3.0 or later', url: 'https://spdx.org/licenses/LGPL-3.0-or-later.html', group: 'software' },
  { value: 'MPL-2.0', label: 'Mozilla Public License 2.0', url: 'https://spdx.org/licenses/MPL-2.0.html', group: 'software' },
  { value: 'EPL-2.0', label: 'Eclipse Public License 2.0', url: 'https://spdx.org/licenses/EPL-2.0.html', group: 'software' },
  { value: 'ISC', label: 'ISC License', url: 'https://spdx.org/licenses/ISC.html', group: 'software' },
  { value: 'Zlib', label: 'zlib License', url: 'https://spdx.org/licenses/Zlib.html', group: 'software' },
  { value: 'Unlicense', label: 'The Unlicense', url: 'https://spdx.org/licenses/Unlicense.html', group: 'software' },
  { value: '0BSD', label: 'BSD Zero Clause License', url: 'https://spdx.org/licenses/0BSD.html', group: 'software' }
]

export const ARTICLE_LICENSES: ArticleLicenseOption[] = [
  ...CREATIVE_COMMONS_LICENSES,
  { value: 'CC0 1.0', label: 'CC0 1.0（公共领域贡献）', url: 'https://creativecommons.org/publicdomain/zero/1.0/', group: 'creative-commons' },
  ...SOFTWARE_LICENSES,
  { value: 'All rights reserved', label: '保留所有权利', url: null, group: 'other' },
  { value: CUSTOM_ARTICLE_LICENSE, label: '自定义协议', url: null, group: 'other' }
]

export function normalizeArticleLicense(value: unknown): string {
  return ARTICLE_LICENSES.some(license => license.value === value) ? String(value) : DEFAULT_ARTICLE_LICENSE
}

export function normalizeArticleLicenseInput(license: unknown, customName: unknown, customText: unknown): ArticleLicenseInput {
  const normalizedLicense = normalizeArticleLicense(license)
  if (normalizedLicense !== CUSTOM_ARTICLE_LICENSE) {
    return { license: normalizedLicense, customName: '', customText: '' }
  }
  const name = String(customName ?? '').trim().slice(0, 120) || '自定义协议'
  const text = String(customText ?? '').replace(/\r\n/g, '\n').trim().slice(0, 20000)
  return { license: normalizedLicense, customName: name, customText: text }
}

export function getArticleLicense(value: unknown): ArticleLicenseOption {
  const normalized = normalizeArticleLicense(value)
  return ARTICLE_LICENSES.find(license => license.value === normalized) ?? ARTICLE_LICENSES[0]
}

export function articleLicenseDisplayName(value: unknown, customName?: string | null): string {
  const license = getArticleLicense(value)
  if (license.value === CUSTOM_ARTICLE_LICENSE) return customName?.trim() || license.label
  return license.label
}
