/*
  # Admin deletes and reset support

  Allows products, locations and users to be deleted without breaking old
  request history. Request rows keep their stored product names and quantities.
*/

ALTER TABLE restock_request_items
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'st';

UPDATE restock_request_items AS item
SET product_name = products.name
FROM products
WHERE item.product_id = products.id
  AND item.product_name IS NULL;

UPDATE restock_request_items
SET product_name = 'Okänd produkt'
WHERE product_name IS NULL;

ALTER TABLE restock_request_items
  ALTER COLUMN product_name SET NOT NULL;

ALTER TABLE restock_requests
  DROP CONSTRAINT IF EXISTS restock_requests_user_id_fkey,
  ADD CONSTRAINT restock_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE restock_requests
  DROP CONSTRAINT IF EXISTS restock_requests_location_id_fkey,
  ADD CONSTRAINT restock_requests_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE restock_request_items
  DROP CONSTRAINT IF EXISTS restock_request_items_product_id_fkey,
  ADD CONSTRAINT restock_request_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
