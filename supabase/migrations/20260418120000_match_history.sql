-- Публичная страница итогов: чтение через service role (Next RSC / API).
-- Прямой доступ anon к таблице не выдаём — только серверное чтение по share_hash.

CREATE TABLE public.match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_hash uuid NOT NULL UNIQUE,
  room_id uuid REFERENCES public.rooms (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  winner text NOT NULL CHECK (winner = ANY (ARRAY['civilians'::text, 'spies'::text])),
  game_end_reason text NOT NULL DEFAULT '',
  location_name text NOT NULL DEFAULT '',
  theme_text text NOT NULL DEFAULT '',
  mode_theme boolean NOT NULL DEFAULT false,
  mode_role boolean NOT NULL DEFAULT false,
  mode_hidden_threat boolean NOT NULL DEFAULT false,
  discussion_duration_ms integer NOT NULL CHECK (discussion_duration_ms >= 0),
  discussion_elapsed_ms integer NOT NULL CHECK (discussion_elapsed_ms >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX match_history_room_id_idx ON public.match_history (room_id);
CREATE INDEX match_history_started_at_idx ON public.match_history (started_at DESC);

ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.match_history IS 'Итоги партии: снимок для страницы /summary/[hash]; вставка только с service role / из game-server.';
