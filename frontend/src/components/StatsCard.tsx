import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  iconColor?: string;
}

export const StatsCard = ({ icon: Icon, value, label, iconColor = "text-primary" }: StatsCardProps) => {
  return (
    <Card className="border-border/60 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">{value}</div>
            <div className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
