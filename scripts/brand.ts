// Shared by scripts/build-brand.mjs (which draws the images) and nuxt.config.ts
// (which links them), so the two never disagree.

// The app's own backgrounds (Squirkle UI light and dark), so the splash
// screen hands over to the first screen without a flash.
export const SPLASH_LIGHT = '#f8f9fb'
export const SPLASH_DARK = '#0f1013'

// iPhone screens that get a home-screen splash image for the PWA: points
// [width, height] and pixel ratio. iOS shows a blank screen for any other.
export const IOS_SCREENS: [number, number, number][] = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
]

export const splashFile = ([w, h, scale]: [number, number, number], mode: 'light' | 'dark') => `/splash/${w * scale}x${h * scale}-${mode}.png`
