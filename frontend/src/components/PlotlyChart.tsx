import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';

// 使用预打包精简核心，规避 plotly.js 全量源码在构建期的编译/体积问题。
const Plot = createPlotlyComponent(Plotly);

export default Plot;
