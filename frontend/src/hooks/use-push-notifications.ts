import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Replace with your generated VAPID public key
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);

            // Check for existing subscription
            navigator.serviceWorker.ready.then(async (registration) => {
                const sub = await registration.pushManager.getSubscription();
                setSubscription(sub);
            });
        }
    }, []);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPush = async () => {
        if (!isSupported) {
            toast.error('Push notifications are not supported in this browser.');
            return;
        }

        if (!VAPID_PUBLIC_KEY) {
            toast.error('Push notifications configuration missing.');
            console.error('Missing VITE_VAPID_PUBLIC_KEY in env variables');
            return;
        }

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== 'granted') {
                toast.error('Notification permission denied.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            setSubscription(sub);
            await saveSubscriptionToDB(sub);

            toast.success('Successfully subscribed to notifications!');
        } catch (error) {
            console.error('Error subscribing to push:', error);
            toast.error('Failed to subscribe to notifications.');
        }
    };

    const saveSubscriptionToDB = async (sub: PushSubscription) => {
        let activeUser: any = null;
        if (!activeUser) {
            const { data } = await supabase.auth.getSession();
            activeUser = data.session?.user as any;
        }

        if (!activeUser) return;

        // We can't use type strict insertion due to how Supabase types are generated here
        const { error } = await (supabase as any)
            .from('push_subscriptions')
            .insert({
                user_id: activeUser.id,
                subscription: JSON.parse(JSON.stringify(sub)) // Serialize the PushSubscription object
            });

        if (error && error.code !== '23505') { // Ignore unique constraint violations (already subscribed)
            console.error('Error saving subscription to DB:', error);
        }
    };

    const unsubscribeFromPush = async () => {
        if (!subscription) return;

        try {
            await subscription.unsubscribe();
            setSubscription(null);

            let activeUser: any = null;
            if (!activeUser) {
                const { data } = await supabase.auth.getSession();
                activeUser = data.session?.user as any;
            }

            if (activeUser) {
                await (supabase as any)
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', activeUser.id);
            }

            toast.success('Unsubscribed from notifications.');
        } catch (error) {
            console.error('Error unsubscribing:', error);
            toast.error('Failed to unsubscribe.');
        }
    };

    return {
        isSupported,
        permission,
        isSubscribed: !!subscription,
        subscribeToPush,
        unsubscribeFromPush
    };
}
