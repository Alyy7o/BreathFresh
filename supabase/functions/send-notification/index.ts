// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// import webpush from 'npm:web-push@3.6.7'

// // Setup VAPID details from environment variables
// const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
// const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

// if (vapidPublicKey && vapidPrivateKey) {
//     webpush.setVapidDetails(
//         'mailto:support@breathfresh.app',
//         vapidPublicKey,
//         vapidPrivateKey
//     )
// }

// const corsHeaders = {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// }


// serve(async (req) => {
//     if (req.method === 'OPTIONS') {
//         return new Response('ok', { headers: corsHeaders })
//     }

//     try {
//         const supabaseClient = createClient(
//             Deno.env.get('SUPABASE_URL') ?? '',
//             Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need service role to bypass RLS for inserting notifications
//         )

//         // 1. Parse Request
//         const { user_id, user_ids, send_to_all, title, message, type, link } = await req.json()

//         if (!title || !message) {
//             throw new Error('Missing required fields: title, message')
//         }

//         if (!user_id && !user_ids && !send_to_all) {
//             throw new Error('Missing required fields: user_id, user_ids, or send_to_all must be provided')
//         }

//         let targetUserIds: string[] = [];

//         if (send_to_all) {
//             // Fetch all users using the service role key from auth admin
//             const { data, error: usersError } = await supabaseClient.auth.admin.listUsers()

//             if (usersError) {
//                 console.error('Failed to fetch all users:', usersError)
//                 throw usersError
//             }
//             targetUserIds = data?.users?.map((u: any) => u.id) || []
//         } else if (user_ids && Array.isArray(user_ids)) {
//             targetUserIds = user_ids;
//         } else if (user_id) {
//             targetUserIds = [user_id];
//         }

//         if (targetUserIds.length === 0) {
//             return new Response(
//                 JSON.stringify({
//                     success: true,
//                     message: 'No users found to send notification to',
//                     pushStats: { success: 0, failed: 0 }
//                 }),
//                 { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
//             )
//         }

//         // 2. Save to in_app_notifications for all target users
//         const notificationsToInsert = targetUserIds.map(id => ({
//             user_id: id,
//             title,
//             message,
//             type: type || 'system',
//             link: link || null
//         }))

//         const { error: insertError } = await supabaseClient
//             .from('in_app_notifications')
//             .insert(notificationsToInsert)

//         if (insertError) {
//             console.error('Failed to save in-app notifications:', insertError)
//             throw insertError
//         }

//         // 3. Find push subscriptions for these users
//         const { data: subscriptions, error: fetchError } = await supabaseClient
//             .from('push_subscriptions')
//             .select('subscription')
//             .in('user_id', targetUserIds)

//         if (fetchError) {
//             console.error('Failed to fetch subscriptions:', fetchError)
//             throw fetchError
//         }

//         let successCount = 0
//         let failureCount = 0

//         // 4. Send Web Push to all devices
//         if (subscriptions && subscriptions.length > 0 && vapidPublicKey && vapidPrivateKey) {
//             const payload = JSON.stringify({
//                 title,
//                 body: message,
//                 url: link || '/'
//             })

//             const pushPromises = subscriptions.map(async (row) => {
//                 try {
//                     await webpush.sendNotification(row.subscription, payload)
//                     successCount++
//                 } catch (error: any) {
//                     console.error('Error sending push:', error)
//                     failureCount++
//                     // Optional: If error is 410 Gone, we should delete the subscription from the DB
//                     if (error.statusCode === 410) {
//                         await supabaseClient
//                             .from('push_subscriptions')
//                             .delete()
//                             .eq('subscription', row.subscription)
//                     }
//                 }
//             })

//             await Promise.all(pushPromises)
//         }

//         return new Response(
//             JSON.stringify({
//                 success: true,
//                 message: `Notification processed for ${targetUserIds.length} users`,
//                 pushStats: { success: successCount, failed: failureCount }
//             }),
//             { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
//         )

//     } catch (error: any) {
//         return new Response(
//             JSON.stringify({ error: error.message }),
//             { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
//         )
//     }
// })
