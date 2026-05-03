---
description: 
---

1. Ask the user: "What feature are you building? Describe it in one sentence."

2. Before calling any agent, state:
   - Feature name
   - Backend files that will change
   - Frontend files that will change  
   - Security model: who can call this endpoint and what data scope
   - Files that must NOT be touched
   Wait for user to confirm this plan.

3. Call @Backend_Engine.md with instruction:
   "Build [feature]. Step 1 and 2 only: migration SQL and repository 
   function. Do not write the handler yet."
   Wait for user approval of the schema and repository.

4. Call @Backend_Engine.md with instruction:
   "The schema is approved. Now build Step 3, 4, and 5: service, 
   handler, and route registration."
   Wait for user approval.

5. Call @Reviewer.md with instruction:
   "Audit all backend code generated in steps 3 and 4 above."
   If Reviewer returns ISSUES FOUND: stop. Tell user what to fix.
   Do not proceed to frontend until Reviewer returns CLEAN.

6. Call @Frontend-Weaver.md with instruction:
   "The backend is approved. The API contract is: [paste the handler's 
   request/response shape]. Build the TypeScript types, API service, 
   hook, and component for this feature."
   Wait for user approval.

7. If this feature has WebSocket events or external API calls:
   Call @Integration-Specialist.md with instruction:
   "Wire the [event name] WebSocket event for [feature]. Backend emits 
   to [room]. Frontend hook must handle reconnection."
   Wait for user approval.

8. Call @Reviewer.md with instruction:
   "Final audit: review all frontend and integration code from steps 
   6 and 7."
   If CLEAN: output the commit message from Reviewer.
   If ISSUES FOUND: send back to the appropriate agent for fixes.