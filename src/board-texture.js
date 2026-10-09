import { componentProp } from './react.js';
import { c, q } from './runtime.js';
import { boardTextureEnabled } from './settings.js';
import { generatedRoots } from './ui.js';

// Seed each inset by map and tile; keep the texture below units and hit targets.
const svgNamespace = "http://www.w3.org/2000/svg";
let textureState = null;
function mapSeed(svg) {
  const view = componentProp(svg, "view");
  return componentProp(svg, "mapName") || view?.map_name || view?.board?.map_name || "forgotten_island";
}
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  value ^= value >>> 16;
  value = Math.imul(value, 2146121005);
  value ^= value >>> 15;
  value = Math.imul(value, 2221713035);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}
function polygon() {
  return document.createElementNS(svgNamespace, "polygon");
}
function clearBoardTexture() {
  if (!textureState) return;
  textureState.observer.disconnect();
  for (const texture of textureState.textures.values()) texture.group.remove();
  textureState = null;
}
function updateBoardTexture() {
  if (!boardTextureEnabled()) {
    clearBoardTexture();
    return;
  }
  const svg = q('[data-m2="board"] svg' + c("svg"));
  if (textureState?.svg !== svg) clearBoardTexture();
  if (!svg) return;
  if (!textureState) {
    const observer2 = new MutationObserver((records) => {
      if (records.some((record) => !record.target.closest?.(".m2-hex-texture") && (record.type !== "childList" || [...record.addedNodes, ...record.removedNodes].some((node) => !node.matches?.(".m2-hex-texture"))))) updateBoardTexture();
    });
    textureState = { svg, observer: observer2, textures: /* @__PURE__ */ new Map() };
    observer2.observe(svg, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["points", "transform"]
    });
  }
  const { textures } = textureState;
  const seed = mapSeed(svg);
  const live = /* @__PURE__ */ new Set();
  for (const tile of svg.querySelectorAll(":scope > g")) {
    const base = tile.querySelector(":scope > polygon");
    if (!base) continue;
    const values = (base.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
    if (values.length !== 12 || !values.every(Number.isFinite)) continue;
    const hex = componentProp(tile, "hex");
    const coordinate = hex ? `${hex.q}_${hex.r}_${hex.s}` : tile.getAttribute("transform");
    if (!coordinate) continue;
    live.add(base);
    let texture = textures.get(base);
    if (!texture) {
      const group = document.createElementNS(svgNamespace, "g");
      group.setAttribute("class", "m2-hex-texture");
      group.setAttribute("pointer-events", "none");
      group.setAttribute("aria-hidden", "true");
      const shade = polygon();
      shade.setAttribute("fill", "#000");
      shade.setAttribute("opacity", "0.08");
      shade.setAttribute("stroke", "none");
      const border = polygon();
      border.setAttribute("fill", "none");
      border.setAttribute("stroke", "#fff");
      border.setAttribute("stroke-opacity", "0.1");
      border.setAttribute("stroke-width", "1");
      border.setAttribute("vector-effect", "non-scaling-stroke");
      group.append(shade, border);
      generatedRoots.add(group);
      texture = { group, shade, border, key: "" };
      textures.set(base, texture);
    }
    if (base.nextElementSibling !== texture.group) base.after(texture.group);
    const spawnType = componentProp(tile, "spawnPoint")?.type;
    texture.border.setAttribute("display", spawnType === "MINION" || spawnType === "HERO" ? "inline" : "none");
    const points = base.getAttribute("points");
    const key = JSON.stringify([seed, coordinate, points]);
    if (texture.key === key) continue;
    texture.key = key;
    const centerX = values.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b) / 6;
    const centerY = values.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b) / 6;
    const angle = 60 * hash(`${seed}|${coordinate}|rotation`);
    const scale = 0.7 + 0.1 * hash(`${seed}|${coordinate}|size`);
    texture.shade.setAttribute("points", points);
    texture.border.setAttribute("points", points);
    texture.group.setAttribute(
      "transform",
      `translate(${centerX} ${centerY}) rotate(${angle}) scale(${scale}) translate(${-centerX} ${-centerY})`
    );
  }
  for (const [base, texture] of textures) {
    if (live.has(base)) continue;
    texture.group.remove();
    textures.delete(base);
  }
}


export { clearBoardTexture, updateBoardTexture };
