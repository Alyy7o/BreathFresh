-- Create push_subscriptions table
create table public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    subscription jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, subscription)
);

-- Turn on RLS
alter table public.push_subscriptions enable row level security;

-- Create policies
create policy "Users can insert their own subscriptions"
    on public.push_subscriptions for insert
    to authenticated
    with check ( auth.uid() = user_id );

create policy "Users can view their own subscriptions"
    on public.push_subscriptions for select
    to authenticated
    using ( auth.uid() = user_id );

create policy "Users can delete their own subscriptions"
    on public.push_subscriptions for delete
    to authenticated
    using ( auth.uid() = user_id );

-- Create in_app_notifications table
create table public.in_app_notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    message text not null,
    type text default 'system',
    is_read boolean default false,
    link text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
alter table public.in_app_notifications enable row level security;

-- Create policies
create policy "Users can view their own notifications"
    on public.in_app_notifications for select
    to authenticated
    using ( auth.uid() = user_id );

create policy "Users can update their own notifications (to mark as read)"
    on public.in_app_notifications for update
    to authenticated
    using ( auth.uid() = user_id )
    with check ( auth.uid() = user_id );
