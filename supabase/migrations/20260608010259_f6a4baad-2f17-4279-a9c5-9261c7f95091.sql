ALTER TABLE public.cells
  ADD COLUMN IF NOT EXISTS meeting_weekday smallint CHECK (meeting_weekday BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS meeting_time time;