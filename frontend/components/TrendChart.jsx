'use client';
import ReactECharts from 'echarts-for-react';

export default function TrendChart({ points, name }) {
  const option = {
    backgroundColor: 'transparent',
    title: {
      text: name,
      textStyle: { color: '#e6e8ee', fontSize: 14 },
      left: 8,
      top: 4,
    },
    grid: { left: 60, right: 24, top: 44, bottom: 40 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0];
        return `${p.axisValue}<br/>NT$ ${p.value.toLocaleString()}`;
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.t.slice(0, 10)),
      axisLabel: { color: '#8b93a7', fontSize: 11 },
      axisLine: { lineStyle: { color: '#262b36' } },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#8b93a7', fontSize: 11, formatter: (v) => v.toLocaleString() },
      splitLine: { lineStyle: { color: '#1f232c' } },
    },
    series: [
      {
        type: 'line',
        data: points.map((p) => p.p),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#4a9eff', width: 2 },
        itemStyle: { color: '#4a9eff' },
        markPoint: {
          symbolSize: 42,
          label: { fontSize: 10, color: '#0f1115' },
          data: points
            .map((p, i) => (p.changed ? { name: '異動', coord: [i, p.p], value: '異動' } : null))
            .filter(Boolean)
            .slice(-5),
        },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 360, width: '100%' }} />;
}
