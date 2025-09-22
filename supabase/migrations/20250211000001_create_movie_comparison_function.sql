-- Migration: Create function to process movie matchup results
-- Description: Adds a helper that updates Elo ratings for a winner/loser pair within a group.

set check_function_bodies = off;

create or replace function public.process_group_movie_comparison(
  p_user_id uuid,
  p_group_id uuid,
  p_winner_item_id integer,
  p_loser_item_id integer,
  p_base_rating numeric default 1200,
  p_provisional_k numeric default 40,
  p_established_k numeric default 20,
  p_master_k numeric default 10
) returns table (
  winner_item_id integer,
  winner_rating numeric,
  winner_comparison_count integer,
  loser_item_id integer,
  loser_rating numeric,
  loser_comparison_count integer
) language plpgsql security definer as
$$
declare
  v_winner_rating numeric := p_base_rating;
  v_loser_rating numeric := p_base_rating;
  v_winner_count integer := 0;
  v_loser_count integer := 0;
  v_expected_winner numeric;
  v_expected_loser numeric;
  v_winner_k numeric;
  v_loser_k numeric;
  v_updated_winner_rating numeric;
  v_updated_loser_rating numeric;
  v_updated_winner_count integer;
  v_updated_loser_count integer;
begin
  perform set_config('search_path', 'public', true);

  if p_winner_item_id = p_loser_item_id then
    raise exception 'Winner and loser must reference different items.';
  end if;

  perform 1
  from public.group_items gi
  where gi.group_id = p_group_id
    and gi.item_id = p_winner_item_id;

  if not found then
    raise exception 'Winner item % does not belong to group %.', p_winner_item_id, p_group_id;
  end if;

  perform 1
  from public.group_items gi
  where gi.group_id = p_group_id
    and gi.item_id = p_loser_item_id;

  if not found then
    raise exception 'Loser item % does not belong to group %.', p_loser_item_id, p_group_id;
  end if;

  insert into public.user_group_item_ratings (user_id, group_id, item_id, rating, comparison_count)
  values (p_user_id, p_group_id, p_winner_item_id, p_base_rating, 0)
  on conflict (user_id, group_id, item_id) do nothing;

  insert into public.user_group_item_ratings (user_id, group_id, item_id, rating, comparison_count)
  values (p_user_id, p_group_id, p_loser_item_id, p_base_rating, 0)
  on conflict (user_id, group_id, item_id) do nothing;

  select rating, comparison_count
    into v_winner_rating, v_winner_count
  from public.user_group_item_ratings
  where user_id = p_user_id
    and group_id = p_group_id
    and item_id = p_winner_item_id
  for update;

  select rating, comparison_count
    into v_loser_rating, v_loser_count
  from public.user_group_item_ratings
  where user_id = p_user_id
    and group_id = p_group_id
    and item_id = p_loser_item_id
  for update;

  v_expected_winner := 1 / (1 + power(10, (v_loser_rating - v_winner_rating) / 400.0));
  v_expected_loser := 1 / (1 + power(10, (v_winner_rating - v_loser_rating) / 400.0));

  v_winner_k := case
    when v_winner_count <= 10 then p_provisional_k
    when v_winner_count <= 30 then p_established_k
    else p_master_k
  end;

  v_loser_k := case
    when v_loser_count <= 10 then p_provisional_k
    when v_loser_count <= 30 then p_established_k
    else p_master_k
  end;

  v_updated_winner_rating := v_winner_rating + v_winner_k * (1 - v_expected_winner);
  v_updated_loser_rating := v_loser_rating + v_loser_k * (0 - v_expected_loser);

  update public.user_group_item_ratings
     set rating = round(v_updated_winner_rating, 4),
         comparison_count = v_winner_count + 1
   where user_id = p_user_id
     and group_id = p_group_id
     and item_id = p_winner_item_id
   returning rating, comparison_count
    into v_updated_winner_rating, v_updated_winner_count;

  update public.user_group_item_ratings
     set rating = round(v_updated_loser_rating, 4),
         comparison_count = v_loser_count + 1
   where user_id = p_user_id
     and group_id = p_group_id
     and item_id = p_loser_item_id
   returning rating, comparison_count
    into v_updated_loser_rating, v_updated_loser_count;

  return query
  select p_winner_item_id,
         v_updated_winner_rating,
         v_updated_winner_count,
         p_loser_item_id,
         v_updated_loser_rating,
         v_updated_loser_count;
end;
$$;

comment on function public.process_group_movie_comparison(uuid, uuid, integer, integer, numeric, numeric, numeric, numeric)
  is 'Updates Elo ratings for a user''s movie matchup within a ranking group.';
