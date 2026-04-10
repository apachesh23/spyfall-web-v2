-- Словарь вопросов «что спросить» + учёт выдачи по партии (game_id = rooms.id).

create table if not exists public.hint_questions (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  question_text text not null
);

create table if not exists public.hint_game_usage (
  game_id uuid not null,
  question_id uuid not null references public.hint_questions (id) on delete cascade,
  primary key (game_id, question_id)
);

create index if not exists hint_game_usage_game_id_idx on public.hint_game_usage (game_id);

alter table public.hint_questions enable row level security;
alter table public.hint_game_usage enable row level security;
-- Политики не задаём: anon/authenticated не видят таблицы; service_role обходит RLS.

insert into public.hint_questions (category_key, question_text)
select v.category_key, v.question_text
from (
  values
    ('people', 'Кого ты чаще всего видишь в таком месте?'),
    ('space', 'Где именно ты обычно оказываешься — ближе к входу или к окну?'),
    ('atmosphere', 'Какое настроение у этого места в твой последний визит?'),
    ('time', 'В какое время суток ты там бываешь чаще всего?'),
    ('items', 'Что из мелочей ты запомнил(а) в последний раз?')
) as v(category_key, question_text)
where not exists (select 1 from public.hint_questions limit 1);

-- Глобальный случайный вопрос (для GET / fallback).
create or replace function public.get_random_hint_question ()
returns table (text text, category_key text)
language sql
security definer
set search_path = public
as $$
  select hq.question_text as text, hq.category_key
  from public.hint_questions hq
  order by random()
  limit 1;
$$;

-- Без повторов внутри одной партии; когда вопросы кончились — снова из всего пула.
create or replace function public.get_random_hint_question_for_game (p_game_id uuid)
returns table (question_text text, category_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select hq.id, hq.question_text, hq.category_key into r
  from public.hint_questions hq
  where not exists (
    select 1
    from public.hint_game_usage u
    where u.game_id = p_game_id and u.question_id = hq.id
  )
  order by random()
  limit 1;

  if not found then
    select hq.id, hq.question_text, hq.category_key into r
    from public.hint_questions hq
    order by random()
    limit 1;
  end if;

  if r.id is null then
    return;
  end if;

  insert into public.hint_game_usage (game_id, question_id)
  values (p_game_id, r.id)
  on conflict do nothing;

  question_text := r.question_text;
  category_key := r.category_key;
  return next;
end;
$$;

grant execute on function public.get_random_hint_question () to service_role;
grant execute on function public.get_random_hint_question_for_game (uuid) to service_role;
