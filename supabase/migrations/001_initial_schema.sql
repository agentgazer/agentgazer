-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- API Keys
-- ============================================================
create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,  -- first 8 chars for display
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index idx_api_keys_user_id on api_keys(user_id);
create index idx_api_keys_key_hash on api_keys(key_hash);

-- ============================================================
-- Agents
-- ============================================================
create table agents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,  -- user-defined identifier
  name text,
  status text not null default 'unknown' check (status in ('healthy', 'degraded', 'down', 'unknown')),
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_id)
);

create index idx_agents_user_id on agents(user_id);

-- ============================================================
-- Agent Events
-- ============================================================
create table agent_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  event_type text not null check (event_type in ('llm_call', 'completion', 'heartbeat', 'error', 'custom')),
  provider text,
  model text,
  tokens_in int,
  tokens_out int,
  tokens_total int,
  cost_usd double precision,
  latency_ms int,
  status_code int,
  error_message text,
  tags jsonb default '{}',
  source text not null check (source in ('sdk', 'proxy')),
  timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_agent_events_user_agent on agent_events(user_id, agent_id);
create index idx_agent_events_timestamp on agent_events(timestamp);
create index idx_agent_events_type on agent_events(event_type);

-- ============================================================
-- Alert Rules
-- ============================================================
create table alert_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  rule_type text not null check (rule_type in ('agent_down', 'error_rate', 'budget')),
  config jsonb not null default '{}',
  enabled boolean not null default true,
  webhook_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_alert_rules_user_agent on alert_rules(user_id, agent_id);

-- ============================================================
-- Alert History
-- ============================================================
create table alert_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_rule_id uuid not null references alert_rules(id) on delete cascade,
  agent_id text not null,
  rule_type text not null,
  message text not null,
  delivered_via text not null check (delivered_via in ('webhook', 'email')),
  delivered_at timestamptz not null default now()
);

create index idx_alert_history_user on alert_history(user_id);
create index idx_alert_history_rule on alert_history(alert_rule_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- API Keys: users can only see/manage their own keys
alter table api_keys enable row level security;
create policy "Users manage own api_keys" on api_keys
  for all using (auth.uid() = user_id);

-- Agents: users can only see their own agents
alter table agents enable row level security;
create policy "Users manage own agents" on agents
  for all using (auth.uid() = user_id);

-- Agent Events: users can only see their own events
alter table agent_events enable row level security;
create policy "Users read own events" on agent_events
  for select using (auth.uid() = user_id);
-- Insert via Edge Function (service role), not direct client insert
create policy "Service role inserts events" on agent_events
  for insert with check (true);

-- Alert Rules: users manage their own alert rules
alter table alert_rules enable row level security;
create policy "Users manage own alert_rules" on alert_rules
  for all using (auth.uid() = user_id);

-- Alert History: users can only see their own alert history
alter table alert_history enable row level security;
create policy "Users read own alert_history" on alert_history
  for select using (auth.uid() = user_id);

-- ============================================================
-- Enable Realtime for agent_events and agents tables
-- ============================================================
alter publication supabase_realtime add table agent_events;
alter publication supabase_realtime add table agents;
