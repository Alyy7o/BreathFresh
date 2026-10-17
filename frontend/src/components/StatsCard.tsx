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
    <Card className="shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 border-0 bg-gradient-to-br from-card to-card/50">
      <CardContent className="p-4 sm:p-6 text-center space-y-2 sm:space-y-3">
        <div className="flex justify-center">
          <div className="p-2 sm:p-3 rounded-full bg-background/50">
            <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${iconColor}`} />
          </div>
        </div>
        <div className="font-bold text-lg sm:text-xl text-foreground">{value}</div>
        <div className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</div>
      </CardContent>
    </Card>
  );
};
