alter table public.products
  add column if not exists ship_to_states text[] default array[
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL',
    'IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT',
    'NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
    'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
  ];

comment on column public.products.ship_to_states is
  'Array of US state codes where this product can be shipped. Default is all 50 + DC. Restricted states are removed based on hemp_state_rules at upload time.';

create index if not exists products_ship_to_states_idx
  on public.products using gin (ship_to_states);
