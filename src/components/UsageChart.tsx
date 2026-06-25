import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface UsageChartProps {
  usageLogs: { timestamp: string; toolName: string }[];
}

export default function UsageChart({ usageLogs }: UsageChartProps) {
  // Aggregate logs by day of week (last 7 days)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getPast7Days = () => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push({
        dayName: daysOfWeek[d.getDay()],
        dateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0
      });
    }
    return arr;
  };

  const chartData = getPast7Days();

  // Populate data
  usageLogs.forEach(log => {
    const logDate = new Date(log.timestamp);
    const logDateStr = logDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    
    const matchedDay = chartData.find(d => d.dateStr === logDateStr);
    if (matchedDay) {
      matchedDay.count += 1;
    }
  });

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-800">Conversions Analytics</h4>
        <p className="text-[10px] text-slate-400">Total tools executed over the last 7 days</p>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis 
              dataKey="dayName" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
            />
            <YAxis 
              allowDecimals={false} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc', radius: 8 }}
              contentStyle={{ 
                background: '#0f172a', 
                border: 'none', 
                borderRadius: '12px',
                fontSize: '11px',
                color: '#f8fafc',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
              }}
              labelClassName="font-bold text-slate-400 mb-1"
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.count > 0 ? '#0284c7' : '#e2e8f0'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
