-- Migration: Create ranking schema tables
-- Description: Establish tables to support generic rankable items and group-based Elo ratings.

set statement_timeout = 0;
set lock_timeout = 0;
set idle_in_transaction_session_timeout = 0;
set client_encoding = 'UTF8';
set standard_conforming_strings = on;
set check_function_bodies = false;
set client_min_messages = warning;
set row_security = off;

create schema if not exists public;

create extension if not exists "pgcrypto" with schema public;

create table if not exists public.item_types (
  id serial primary key,
  name varchar(255) not null unique,
  slug varchar(255) not null unique
);

comment on table public.item_types is 'Categories of items that can be ranked (e.g., Movie, Book).';
comment on column public.item_types.name is 'Display name for the item category.';
comment on column public.item_types.slug is 'URL-friendly identifier for the item category.';

create table if not exists public.rankable_items (
  id serial primary key,
  item_type_id integer not null references public.item_types(id) on delete restrict,
  external_id varchar(255) unique,
  name varchar(255) not null,
  image_path varchar(1024),
  metadata jsonb
);

comment on table public.rankable_items is 'Library of individual items that can be ranked across all categories.';
comment on column public.rankable_items.item_type_id is 'Foreign key to item_types indicating the category of the item.';
comment on column public.rankable_items.external_id is 'Optional ID from an external provider (e.g., TMDb).';
comment on column public.rankable_items.metadata is 'Optional JSON payload for auxiliary data such as release year or author.';

create table if not exists public.ranking_groups (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  description text,
  creator_id uuid not null,
  item_type_id integer not null references public.item_types(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.ranking_groups is 'User-created collections of rankable items scoped to a single item type.';
comment on column public.ranking_groups.creator_id is 'Identifier for the user who created the group (stored in an external auth system).';
comment on column public.ranking_groups.item_type_id is 'Ensures the group only contains items from a single item type.';

create table if not exists public.group_items (
  group_id uuid not null references public.ranking_groups(id) on delete cascade,
  item_id integer not null references public.rankable_items(id) on delete cascade,
  primary key (group_id, item_id)
);

comment on table public.group_items is 'Join table connecting ranking groups to the items they include.';

create table if not exists public.group_participants (
  user_id uuid not null,
  group_id uuid not null references public.ranking_groups(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, group_id)
);

comment on table public.group_participants is 'Tracks which users participate in each ranking group.';
comment on column public.group_participants.user_id is 'Identifier for the participating user (stored in an external auth system).';

create table if not exists public.user_group_item_ratings (
  user_id uuid not null,
  group_id uuid not null references public.ranking_groups(id) on delete cascade,
  item_id integer not null references public.rankable_items(id) on delete cascade,
  rating numeric(10,4) not null,
  comparison_count integer not null default 0,
  primary key (user_id, group_id, item_id)
);

comment on table public.user_group_item_ratings is 'Elo rating data for a given user, item, and ranking group context.';
comment on column public.user_group_item_ratings.rating is 'Current Elo rating for the item within the user''s group context.';
comment on column public.user_group_item_ratings.comparison_count is 'How many head-to-head comparisons the user has logged for the item.';

create index if not exists rankable_items_item_type_id_idx on public.rankable_items (item_type_id);
create index if not exists ranking_groups_item_type_id_idx on public.ranking_groups (item_type_id);
create index if not exists group_items_item_id_idx on public.group_items (item_id);
create index if not exists group_participants_group_id_idx on public.group_participants (group_id);
create index if not exists user_group_item_ratings_group_id_idx on public.user_group_item_ratings (group_id);
create index if not exists user_group_item_ratings_item_id_idx on public.user_group_item_ratings (item_id);
