/**
 * Named motion curves for GSAP, mirroring the CSS tokens in styles/tokens.css
 * (Penner equivalents of the same cubic-beziers). Never write a raw ease in a component.
 */
export const EASE = {
  /** Things arriving (CSS --ease-enter, ease-out-quart). */
  enter: 'quart.out',
  /** Parts settling into a joint (CSS --ease-seat, ease-out-quint). */
  seat: 'quint.out',
  /** On-screen movement, camera travel (CSS --ease-travel, ease-in-out-cubic). */
  travel: 'cubic.inOut',
} as const;

/** Seconds, mirroring --dur-* tokens. */
export const DURATION = {
  swap: 0.15,
  reveal: 0.64,
} as const;
