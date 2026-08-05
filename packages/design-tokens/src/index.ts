export const designTokens = {
  canvas: {
    width: 1194,
    height: 834,
    renderScaleDefault: 1.5,
    renderScaleMaximum: 2
  },
  color: {
    ink: '#22343A',
    inkMuted: '#5D6F73',
    paper: '#FAFCF8',
    paperStrong: '#FFFFFF',
    cityMist: '#DCEBE6',
    road: '#425D66',
    roadEdge: '#E8E4D8',
    teal: '#4C9C8A',
    tealSoft: '#CFE6DE',
    blue: '#4F8FB8',
    blueSoft: '#D6E8F2',
    coral: '#E87868',
    coralSoft: '#F7D9D2',
    yellow: '#E5BD57',
    yellowSoft: '#F5E9B9',
    success: '#3B946B',
    warning: '#B77B2B',
    danger: '#C55353',
    overlay: 'rgba(26, 43, 49, 0.38)'
  },
  player: {
    P1: '#E87868',
    P2: '#4F8FB8',
    P3: '#E5BD57',
    P4: '#5CA57A'
  },
  radius: {
    small: 10,
    medium: 16,
    large: 24,
    modal: 30,
    pill: 999
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32
  },
  shadow: {
    floating: '0 18px 54px rgba(29, 48, 55, 0.18)',
    compact: '0 10px 28px rgba(29, 48, 55, 0.14)',
    focus: '0 0 0 3px rgba(76, 156, 138, 0.28)'
  },
  motion: {
    instant: 100,
    fast: 180,
    normal: 280,
    deliberate: 420,
    moveStep: 340,
    dice: 620
  },
  zIndex: {
    canvas: 0,
    hud: 20,
    context: 30,
    modal: 50,
    toast: 60
  }
} as const;

export type DesignTokens = typeof designTokens;
