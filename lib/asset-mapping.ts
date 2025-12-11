/**
 * Asset mapping for development environment
 * Maps short names (@filename) to data URLs
 */

// 开发环境：文件名 → data URL 的映射
const assetMapping = new Map<string, string>();

/**
 * 注册资产映射（开发环境使用）
 */
export function registerAsset(filename: string, dataUrl: string): void {
  assetMapping.set(filename, dataUrl);
  console.log(`Registered asset mapping: ${filename} -> data URL (${dataUrl.length} chars)`);
}

/**
 * 解析资产 URL（支持短名称和完整 URL）
 */
export function resolveAssetUrl(urlOrShortName: string): string {
  // 如果是 @filename 格式，查找映射
  if (urlOrShortName.startsWith('@')) {
    const shortName = urlOrShortName.slice(1);
    const dataUrl = assetMapping.get(shortName);
    if (dataUrl) {
      return dataUrl;
    }
    // 找不到映射，返回原值（可能是错误）
    console.warn(`Asset mapping not found for: ${shortName}`);
    return urlOrShortName;
  }
  // 已经是完整 URL（http/https 或 data:），直接返回
  return urlOrShortName;
}

/**
 * 生成短名称（@filename）
 */
export function getShortName(filename: string): string {
  return `@${filename}`;
}

/**
 * 检查是否是短名称格式
 */
export function isShortName(url: string): boolean {
  return url.startsWith('@');
}

/**
 * 清除所有映射（用于测试或重置）
 */
export function clearAssetMapping(): void {
  assetMapping.clear();
}


