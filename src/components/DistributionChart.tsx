import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from 'recharts';

interface DistributionChartProps {
  data: { name: string; value: number; color: string }[];
}

export default function DistributionChart({ data }: DistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim/50 text-[10px] font-black uppercase tracking-widest italic">
        Insufficient Data for Neural Mapping
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#151515', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '8px',
              fontSize: '12px',
              color: '#fff'
            }}
            itemStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value} XP`, 'XP Earned']}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => (
              <span className="text-[10px] font-black text-text-dim uppercase tracking-widest italic mr-4">
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
