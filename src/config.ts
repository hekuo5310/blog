/**
 * 判断一个可选环境变量是否真的配置了值。
 * 默认值 null（或 undefined / 空字符串 / 字符串 "null" / "empty"）都视为未配置，对应功能不启用。
 */
export function isConfigured(value: string | undefined | null): boolean {
  return value !== undefined && value !== null && value !== '' && value !== 'null' && value !== 'empty'
}
