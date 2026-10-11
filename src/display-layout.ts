/** CSS pixels already account for Windows scaling and browser page zoom.
 * DPR alone cannot distinguish a high-density screen from zoom, so never
 * shrink the interface to compensate for it. Keep this query in sync with CSS. */
export const COMPACT_LAYOUT_QUERY = '(max-width: 1180px), (max-height: 620px) and (max-width: 1600px)';

export interface DisplayMetrics {
  width:number; height:number; pixelRatio:number; viewportScale:number;
  screenWidth:number; screenHeight:number;
}

export function displayProfile(metrics:DisplayMetrics) {
  return {
    ...metrics,
    compact:metrics.width<=1180 || (metrics.height<=620 && metrics.width<=1600),
  };
}

/** Re-evaluate after page zoom, pinch zoom, rotation or a monitor/DPI change. */
export function observeDisplay() {
  let density:MediaQueryList;
  const update = () => {
    const profile=displayProfile({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,
      pixelRatio:window.devicePixelRatio||1,viewportScale:window.visualViewport?.scale||1,
      screenWidth:window.screen.width,screenHeight:window.screen.height});
    document.documentElement.dataset.layout=profile.compact?'compact':'wide';
    // Useful for layout inspection, without claiming an exact OS zoom percentage.
    document.documentElement.dataset.displayDensity=String(profile.pixelRatio);
    document.documentElement.dataset.viewportScale=String(profile.viewportScale);
  };
  const watchDensity = () => {
    density?.removeEventListener('change', densityChanged);
    density=matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
    density.addEventListener('change', densityChanged);
  };
  const densityChanged = () => { watchDensity(); update(); window.dispatchEvent(new Event('displaychange')); };
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  watchDensity(); update();
}
