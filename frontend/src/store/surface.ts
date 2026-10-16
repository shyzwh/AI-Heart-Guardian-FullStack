import { create } from 'zustand';

/**
 * 面板质感：毛玻璃(glass) / 磨砂(frosted) / 纯色(solid)。
 * 医疗专业风默认纯色（最清晰），用户可在顶栏切换。
 * 通过给 <html> 加 data-surface 属性，由 CSS 统一控制卡片背景。
 */
export type SurfaceMode = 'solid' | 'glass' | 'frosted';

const SURFACE_KEY = 'ecg-screen:surface';
const VALID: SurfaceMode[] = ['solid', 'glass', 'frosted'];

function loadSurface(): SurfaceMode {
  try {
    const v = localStorage.getItem(SURFACE_KEY) as SurfaceMode | null;
    return v && VALID.includes(v) ? v : 'solid';
  } catch {
    return 'solid';
  }
}

function applySurface(mode: SurfaceMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.surface = mode;
}

interface ISurfaceState {
  mode: SurfaceMode;
  setMode: (mode: SurfaceMode) => void;
  init: () => void;
}

export const useSurfaceStore = create<ISurfaceState>((set) => ({
  // 初始值直接从 localStorage 读取（initializer 只执行一次）
  mode: loadSurface(),
  setMode: (mode) => {
    try {
      localStorage.setItem(SURFACE_KEY, mode);
    } catch {
      /* ignore */
    }
    applySurface(mode);
    set({ mode });
  },
  // 仅把当前模式同步到 <html data-surface>（DOM 副作用，不触发额外渲染）
  init: () => {
    applySurface(useSurfaceStore.getState().mode);
  },
}));

/** 各质感对应的面板 className，供布局/卡片复用。 */
export const SURFACE_PANEL_CLASS: Record<SurfaceMode, string> = {
  solid: 'bg-card border shadow-sm',
  glass: 'border border-white/40 shadow-lg backdrop-blur-md bg-white/55',
  frosted: 'border border-white/25 shadow-xl backdrop-blur-2xl bg-white/35 saturate-150',
};
