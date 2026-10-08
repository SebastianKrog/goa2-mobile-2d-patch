// jsdom parses screen media queries without evaluating them. Select the same
// canonical branches explicitly; preserve the originals for orientation changes.
const originals = new WeakMap();
const landscapeQuery =
  '(orientation: landscape) and (min-width: 600px) and (max-width: 1200px) and (max-height: 600px)';
function selectScreenMedia(style, enabled) {
  if (!originals.has(style))
    originals.set(
      style,
      [...style.sheet.cssRules].map((rule) => ({
        condition: rule.conditionText,
        text: rule.conditionText
          ? [...rule.cssRules].map((child) => child.cssText).join('\n')
          : rule.cssText,
      })),
    );
  style.textContent = originals
    .get(style)
    .filter((rule) => !rule.condition || enabled.has(rule.condition))
    .map((rule) => rule.text)
    .join('\n');
}
module.exports = { selectScreenMedia, landscapeQuery };
