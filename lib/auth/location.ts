/** 离开当前页。单独放在这里，便于测试替换，而不必改写浏览器的 location。 */
export function replaceDocument(url: string) {
  window.location.replace(url);
}
