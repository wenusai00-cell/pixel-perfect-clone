
## Goal
1. Har AI employee ke role ke according sirf zaroori tools ki permission maango (sab ek sath nahi).
2. Jab client employee open kare, pehle ek "Connect your tools" prompt aaye — sirf un tools ka jo us employee ko chahiye.
3. Jab client sab required tools connect kar de, prompt dobara na aaye.
4. "10 gyms in New York" jaisi search queries fix karo — abhi reply nahi aata.

## Approach

### A. Role → Required tools mapping
Naya file `src/lib/employee-tools.ts` banaaunga jo role title se required tools nikaalega:

| Role keyword | Tools |
|---|---|
| outreach / sales / email | `gmail` |
| research / analyst / SEO | (no connector — web tools built-in) |
| scheduler / assistant / calendar | `google_calendar`, `gmail` |
| social media / marketing | `gmail` (+ future: x, linkedin) |
| ops / data / sheets | `google_sheets` |
| maps / local / lead-gen | `google_maps_platform` |
| content / writer | `google_docs` |
| default | `gmail` |

Har tool ka human label + connector_id + icon.

### B. Permission storage
Already existing table `employee_permissions` use karenge. Key = connector_id (e.g. `gmail`). `granted=true` jab client connect kare. Connection ID bhi `granted_at` ke jagah ek naye column `connection_id` me store karna padega.

**Migration:** `ALTER TABLE employee_permissions ADD COLUMN connection_id text;`

### C. UI flow (employee page)
- Page load par: required tools list nikaalo → DB se check karo kaunse granted hain.
- Agar koi missing hai → ek modal/sheet dikhao: "Connect your tools" with cards: [Gmail — Connect], [Google Calendar — Connect].
- Connect button → `connectAppUser` (per-user OAuth via Lovable App User Connector) call kare → on success `employee_permissions` me row insert/update `granted=true, connection_id=...`.
- Jab sab granted → modal band, chat khulta hai.
- Already granted → modal hi nahi aata.

### D. App User Connector setup
- `src/integrations/lovable/appUserConnector.ts` + `appUserConnectorClient.ts` create karunga (server + client helpers).
- Server fn `startConnectorOAuth(connectorId)` jo per-user OAuth URL banaye.
- Server fn `saveConnection({ employee_id, connector_id, connection_id })` jo DB me save kare.
- Server fn `getEmployeeConnections(employee_id)` jo granted tools laaye.
- **User ko `*_APP_USER_CONNECTOR_CLIENT_ID` secrets dene padenge** har Google service ke liye (Gmail, Calendar, Sheets, Docs, Maps). Pehle list ke baad add_secret call karunga.

### E. Chat tool integration
`chat.functions.ts` me:
- Employee ke granted connections fetch karo.
- Agar Gmail granted → `gmail_send` tool register karo jo `callAsAppUser` use kare.
- Same Calendar/Sheets/Docs/Maps ke liye.
- Agar required tool granted nahi → tool register hi mat karo, aur system prompt me note: "User has not connected X yet — politely ask them to connect from the top of the screen."

### F. Search fix ("10 gyms in New York")
Yeh issue is liye hua kyunki maps connector nahi tha + AI ne empty reply diya. Fix:
- Maps wale employee ko `google_maps_platform` connector required tool me daalo.
- Agar connected ho → `gmaps_places_search(query)` tool call kare aur top N return kare.
- Agar connected nahi → fallback: `deep_search` (Firecrawl) se Google Maps URL scrape, ya direct "Yelp / Google search results" se parse karke list de — kabhi empty reply nahi.
- System prompt me strict rule: "Never return an empty answer. If a tool fails, retry with a different one. For lists like 'top N gyms/restaurants/places in X', always return a numbered list with name + address + (rating if available)."

## Files to create/edit
- **Create** `src/lib/employee-tools.ts` — role→tools mapping + tool metadata.
- **Create** `src/integrations/lovable/appUserConnector.ts` (server) + `appUserConnectorClient.ts` (client).
- **Create** `src/lib/connections.functions.ts` — server fns: `startConnectorOAuth`, `saveConnection`, `getEmployeeConnections`.
- **Edit** `src/routes/employee.$id.tsx` — add ConnectToolsModal that auto-shows if missing tools.
- **Edit** `src/lib/chat.functions.ts` — register tools per granted connection; add maps + fallback search; strict "never empty reply" prompt.
- **Migration** — add `connection_id` column to `employee_permissions`.

## Required secrets from you
Mujhe in connector client IDs ki zarurat hogi (har Google service ke liye alag, Lovable app-user OAuth ke liye):
1. `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` (Gmail + Calendar + Drive + Docs + Sheets ek hi cover karega kyunki Google ka connector family `google` hai)
2. `GOOGLE_MAPS_APP_USER_CONNECTOR_CLIENT_ID` (Maps alag)

Plan approve karo to migration → secrets → code is order me chalu karta hu.
