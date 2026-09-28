# Privacy — minors' data

Back to `CLAUDE.md` · Enforced by the Five Locks and `docs/05-schema-and-access.md`

Many athletes are minors. Sleep, soreness, stress, and injury data is sensitive. This is not legal advice — before selling to a school, talk with someone who knows student data law (FERPA and Florida's student privacy rules).

- **Access Lock + Isolation Lock** cover who can see what. Test them every schema change.
- Collect only what a Setup answer uses. No free-text notes from athletes.
- Parent or guardian consent recorded on the roster screen by the Owner/Operator for anyone under 18 (`athletes.parent_consent_at`). No consent, no invite.
- Minor status comes from `athletes.birth_year`. Birth year alone can't pin an 18th birthday, so treat an athlete as a minor while (current year − birth year) ≤ 18.
- Athlete invites for minors may go to a parent's email; the parent sets the password with the athlete.
- Parent share links follow the **Share Lock**: one athlete, expiring.
- Serious stress or pain never stays in the app: `stress.referral` and `body.pain_route` send it to a person.
- Owner can export or delete an athlete's data on request (log it in `audit_log`).
- **Secret Lock:** keys never in browser code, chat, or these docs. `.env` stays out of git.
