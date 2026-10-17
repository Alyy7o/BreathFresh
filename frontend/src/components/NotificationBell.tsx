import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: string;
    link: string | null;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let activeUser: any = null;

        // Fetch initial notifications
        const fetchNotifications = async () => {
            if (!activeUser) {
                const { data } = await supabase.auth.getSession();
                activeUser = data.session?.user as any;
            }
            if (!activeUser) return;

            // @ts-ignore - Bypass strict Supabase DB typing
            const { data } = await (supabase as any)
                .from("in_app_notifications")
                .select("*")
                .eq("user_id", activeUser.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (data) {
                setNotifications(data as unknown as Notification[]);
                setUnreadCount((data as unknown as Notification[]).filter((n) => !n.is_read).length);
            }
        };

        fetchNotifications();

        if (!activeUser) return;

        // Subscribe to realtime changes
        const channel = supabase
            .channel("schema-db-changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "in_app_notifications",
                    filter: `user_id=eq.${activeUser.id}`,
                },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setNotifications((prev) => [payload.new as unknown as Notification, ...prev]);
                        setUnreadCount((prev) => prev + 1);
                    } else if (payload.eventType === "UPDATE") {
                        setNotifications((prev) =>
                            prev.map((n) =>
                                n.id === payload.new.id ? { ...n, is_read: (payload.new as any).is_read } : n
                            )
                        );
                        if ((payload.new as any).is_read && !(payload.old as any).is_read) {
                            setUnreadCount((prev) => Math.max(0, prev - 1));
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const markAsRead = async (id: string, is_read: boolean) => {
        if (is_read) return;

        // @ts-ignore - Bypass strict Supabase DB typing
        await (supabase as any)
            .from("in_app_notifications")
            .update({ is_read: true } as any)
            .eq("id", id);

        // Optimistic UI update
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id, notification.is_read);
        if (notification.link) {
            window.location.href = notification.link;
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-4 py-2 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="text-xs text-white bg-secondary px-2 py-1 rounded-full">
                            {unreadCount} new
                        </span>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length > 0 ? (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <DropdownMenuItem
                                    key={notification.id}
                                    className={`flex flex-col items-start gap-1 p-4 cursor-pointer border-b last:border-0 focus:bg-muted/50 hover:bg-muted/50 focus:text-accent-foreground hover:text-accent-foreground ${!notification.is_read ? 'bg-primary/5' : ''}`}
                                    onSelect={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start justify-between w-full">
                                        <span className={`text-sm font-medium ${!notification.is_read ? 'text-primary' : ''}`}>
                                            {notification.title}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                        {notification.message}
                                    </p>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No notifications yet.
                        </div>
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
