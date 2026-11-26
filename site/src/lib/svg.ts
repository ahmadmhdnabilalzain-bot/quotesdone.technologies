/**
 * Prepare a master logo SVG (imported with ?raw) for inlining. The paths are never touched:
 * we only strip the fixed size (CSS sizes it), the title/desc, and set the accessible role.
 */
export interface InlineSvgOptions {
  className: string;
  /** Accessible name. Omit for a decorative copy (aria-hidden). */
  label?: string;
}

export function inlineSvg(raw: string, { className, label }: InlineSvgOptions): string {
  const body = raw
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>/g, '');
  const a11y = label ? `role="img" aria-label="${escapeAttr(label)}"` : 'aria-hidden="true"';
  return body.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const kept = attrs
      .replace(/\s(width|height|role|aria-labelledby|aria-label|aria-hidden)="[^"]*"/g, '')
      .trim();
    return `<svg ${kept} class="${escapeAttr(className)}" ${a11y} focusable="false">`;
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
