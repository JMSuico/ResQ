// [Layer: Shared/Charts]
// Responsibility: 7-day x 24-hour incident density heatmap matrix.
// DO NOT compute CSS grid cells with unbounded row numbers.

import React from 'react';

export const HeatmapChart: React.FC<{
  matrix?: number[][];
  title?: string;
}> = ({ title = 'Weekly Incident Density Heatmap' }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['00', '04', '08', '12', '16', '20'];

  // 7 days x 6 time blocks dummy/telemetry matrix
  const grid = [
    [1, 0, 4, 8, 3, 2],
    [0, 1, 6, 9, 5, 1],
    [2, 0, 5, 7, 8, 4],
    [1, 2, 7, 12, 6, 3],
    [3, 1, 9, 14, 11, 7],
    [5, 4, 11, 15, 12, 9],
    [4, 2, 8, 10, 7, 5]
  ];

  const getColor = (val: number) => {
    if (val === 0) return 'bg-slate-800/40';
    if (val < 4) return 'bg-sky-950/70 text-sky-300';
    if (val < 8) return 'bg-sky-700/80 text-white';
    if (val < 12) return 'bg-amber-600/90 text-white font-bold';
    return 'bg-rose-600 text-white font-bold animate-pulse';
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
      <div className="flex flex-col gap-1.5 mt-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pl-8">
          {hours.map((h) => (
            <span key={h} className="w-10 text-center">{h}:00</span>
          ))}
        </div>
        {days.map((day, dIdx) => (
          <div key={day} className="flex items-center gap-1.5">
            <span className="w-6 text-[10px] font-mono text-slate-400">{day}</span>
            {grid[dIdx].map((val, hIdx) => (
              <div
                key={hIdx}
                className={`w-10 h-7 rounded flex items-center justify-center text-[10px] font-mono ${getColor(val)} transition-transform hover:scale-110 cursor-pointer`}
                title={`${day} ${hours[hIdx]}:00 - ${val} incidents`}
              >
                {val > 0 ? val : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
