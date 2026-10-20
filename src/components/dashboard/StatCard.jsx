import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'primary', delay = 0 }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-amber-500/10 text-amber-600',
    purple: 'bg-violet-500/10 text-violet-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="p-5 hover:shadow-lg transition-shadow duration-300 border-0 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <div className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                trend > 0 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
              )}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", colorMap[color])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
