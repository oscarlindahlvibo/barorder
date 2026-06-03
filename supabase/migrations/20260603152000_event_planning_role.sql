/*
  Add event planning as an assignable role.
*/

UPDATE users
SET roles = array_append(roles, 'event_planning')
WHERE role = 'admin'
  AND NOT roles @> ARRAY['event_planning'];
