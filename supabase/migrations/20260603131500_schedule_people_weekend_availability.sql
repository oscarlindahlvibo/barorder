/*
  Store Friday and Saturday availability directly on schedule people.
*/

ALTER TABLE schedule_people ADD COLUMN IF NOT EXISTS friday_start text;
ALTER TABLE schedule_people ADD COLUMN IF NOT EXISTS friday_end text;
ALTER TABLE schedule_people ADD COLUMN IF NOT EXISTS saturday_start text;
ALTER TABLE schedule_people ADD COLUMN IF NOT EXISTS saturday_end text;

UPDATE schedule_people
SET friday_start = available_start,
    friday_end = available_end
WHERE preferred_day = 'Fredag'
  AND friday_start IS NULL
  AND available_start IS NOT NULL
  AND available_end IS NOT NULL;

UPDATE schedule_people
SET saturday_start = available_start,
    saturday_end = available_end
WHERE preferred_day = 'Lördag'
  AND saturday_start IS NULL
  AND available_start IS NOT NULL
  AND available_end IS NOT NULL;
