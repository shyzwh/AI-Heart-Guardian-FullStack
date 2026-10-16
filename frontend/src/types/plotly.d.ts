declare module 'plotly.js-dist-min' {
  const Plotly: unknown;
  export default Plotly;
}

declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react';
  interface PlotParams {
    data?: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    frames?: unknown[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: unknown, graphDiv: HTMLElement) => void;
    onPurge?: (figure: unknown, graphDiv: HTMLElement) => void;
    onRelayout?: (event: Readonly<Record<string, unknown>>) => void;
    [key: string]: unknown;
  }
  export default function createPlotlyComponent(plotly: unknown): ComponentType<PlotParams>;
}
