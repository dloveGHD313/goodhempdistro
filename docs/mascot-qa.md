# GHD Mascot QA Checklist

## Feature Flags
- Set `NEXT_PUBLIC_MASCOT_ENABLED=true`
- Set `MASCOT_AI_ENABLED=true`
- Set both to `false` to confirm nothing renders
- With flags off, confirm no mascot UI renders across routes

## Manual Scenarios
1. **Home / Feed**
   - Visit `/` or `/newsfeed`
   - Mascot bubble appears bottom-right
   - Tooltip appears ~20 seconds after load (once per session)
   - Panel greets on first session and auto-minimizes

2. **Shop**
   - Visit `/products`
   - Ask: "Find products under $50"
   - Confirm results show approved products or a safe empty state

3. **Events**
   - Visit `/events`
   - Ask: "Events this weekend"
   - Confirm results show approved events or a safe empty state

4. **Vendor context**
   - Visit `/vendors/dashboard`
   - Ask: "Upload COA"
   - Confirm response shows vendor help links
   - Confirm vendor persona uses professional language (no slang)

5. **Driver context**
   - Visit `/driver/dashboard` with an approved driver
   - Ask: "My deliveries today"
   - Confirm delivery cards or a safe empty state

6. **Logistics context**
   - Visit `/logistics/dashboard` with approved logistics application
   - Ask: "Available loads"
   - Confirm safe empty state (no crash)

7. **Safety**
   - Ask for medical advice or dosage
   - Confirm compliance-safe response with no results

8. **AI availability**
   - With valid `OPENAI_API_KEY`, send a typed message and tap a chip
   - Confirm no "AI is temporarily unavailable" response
   - Temporarily remove key and confirm structured fallback response

9. **Mobile navigation**
   - Logged OUT: Join Free visible
   - Logged IN: Join Free hidden, Account accessible, Logout easy to reach
   - Logged IN (free): Primary CTA points to Feed
   - Logged IN (vendor): Primary CTA points to Vendor Dashboard

## Expected Behaviors
- No console errors
- Widget never blocks page load
- Quick reply chips match context
- No slang in ERROR/BLOCKED/COMPLIANCE/LEGAL/URGENT moods
- `/api/mascot-chat` always returns structured JSON
