const TAGS = new Set([
  'ruby',
  'rt',
  'rp',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'span',
  'div',
  'p',
  'ol',
  'ul',
  'li',
  'details',
  'summary',
  'a',
  'br',
  'hr',
  'b',
  'i',
  'em',
  'strong',
]);
const STYLES = new Set([
  'fontStyle',
  'fontWeight',
  'fontSize',
  'color',
  'backgroundColor',
  'textDecorationLine',
  'textDecorationStyle',
  'textDecorationColor',
  'borderColor',
  'borderStyle',
  'borderRadius',
  'borderWidth',
  'verticalAlign',
  'textAlign',
  'textEmphasis',
  'textShadow',
  'margin',
  'marginTop',
  'marginLeft',
  'marginRight',
  'marginBottom',
  'padding',
  'paddingTop',
  'paddingLeft',
  'paddingRight',
  'paddingBottom',
  'wordBreak',
  'whiteSpace',
  'listStyleType',
]);

function renderContent(content: unknown, depth = 0): Node {
  const fragment = document.createDocumentFragment();

  if (depth > 100 || content === null || content === undefined) {
    return fragment;
  }

  if (typeof content === 'string' || typeof content === 'number') {
    return document.createTextNode(String(content));
  }

  if (Array.isArray(content)) {
    fragment.append(...content.map((child: unknown) => renderContent(child, depth + 1)));

    return fragment;
  }

  if (typeof content !== 'object') {
    return fragment;
  }

  const node = content as Record<string, unknown>;

  if (node.type === 'text') {
    return renderContent(node.text, depth + 1);
  }

  if (node.type === 'structured-content') {
    return renderContent(node.content, depth + 1);
  }

  if (typeof node.tag !== 'string' || !TAGS.has(node.tag)) {
    return fragment;
  }

  const element = document.createElement(node.tag);

  for (const attribute of ['lang', 'title']) {
    if (typeof node[attribute] === 'string') {
      element.setAttribute(attribute, node[attribute]);
    }
  }

  if (node.tag === 'a' && typeof node.href === 'string') {
    const href = node.href
      .replace(/^\?query=([^&]+)(?:&wildcards=\w+)?$/, '/parse?text=$1')
      .replace(/^\/parse\?query=/, '/parse?text=');

    try {
      const url = new URL(href, 'https://jiten.moe');

      if (url.protocol === 'https:' || url.protocol === 'http:') {
        element.setAttribute('href', url.href);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
    } catch {
      // Invalid dictionary links remain readable text.
    }
  }

  for (const attribute of ['colSpan', 'rowSpan']) {
    const value = node[attribute];

    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1000) {
      element.setAttribute(attribute.toLowerCase(), String(value));
    }
  }

  if (node.style && typeof node.style === 'object') {
    for (const [key, raw] of Object.entries(node.style)) {
      const value: unknown = Array.isArray(raw) ? raw.join(' ') : raw;

      if (
        STYLES.has(key) &&
        (typeof value === 'string' || typeof value === 'number') &&
        !/url\s*\(|image-set\s*\(|symbols\s*\(|var\s*\(|[\\{};@]/i.test(String(value))
      ) {
        element.style.setProperty(
          key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          String(value),
        );
      }
    }
  }

  element.append(renderContent(node.content, depth + 1));

  return element;
}

export function renderDictionaryDefinitions(definitions: unknown[]): HTMLElement {
  const content = document.createElement('div');

  content.className = 'dictionary-content';

  if (definitions.length === 1) {
    content.append(renderContent(definitions[0]));
  } else {
    const list = document.createElement('ol');

    for (const definition of definitions) {
      const item = document.createElement('li');

      item.append(renderContent(definition));
      list.append(item);
    }
    content.append(list);
  }

  return content;
}
