# ServiceFlow MVP

A clickable, phone-friendly prototype for service businesses.

## Included
- Add jobs with customer, phone, address, date/time, duration, complete-by date and notes
- Daily job list
- On My Way message
- Arrived message
- Complete Job status
- Review request queue demo
- Customizable company/technician/message templates
- Apple Maps directions
- Data saved locally in the browser

## Run
Open `index.html` in a browser.

For the best phone experience, host the folder with any basic static web host or local development server.

## Important
This MVP opens the phone's SMS composer. It does **not** silently send texts in the background yet. Real automatic texting requires a backend and an SMS provider (for example, Twilio) plus proper customer-consent/opt-out handling.

## Recommended production build
1. Frontend: React / Next.js or React Native
2. Backend + database: Supabase/Postgres
3. SMS: Twilio
4. Maps/ETA: Google Maps Platform or Mapbox
5. Auth: Supabase Auth
6. Billing: Stripe
7. Scheduled review messages: server-side job queue / scheduled functions
