> **Superseded.** This original proposal is kept for reference. The current design is in [docs/design.md](docs/design.md). Where the two disagree, the design wins.

# FAILURESHIP

## Climb the ladder. Manage the narrative. Leave the consequences downstairs.

**Game proposal — working draft, 31 October 2026**

## 1. High concept

_Failureship_ is a satirical, single-player corporate management game in which the player starts as an insignificant junior employee on the ground floor of an office tower and schemes their way to the CEO's penthouse.

The objective is **not** to fix the company. It is to become the most successful practitioner of _failureship_: taking credit, accumulating power, expanding bureaucracy, gaming metrics, avoiding blame, launching unnecessary transformations and profiting from the difference between **appearing effective** and **being effective**.

The building is the game's central visual metaphor and primary navigation interface. At the bottom: stained carpets, broken coffee machines and fluorescent lights. At the top: marble, private lifts, executive dining and magnificent views. Every promotion literally moves the player up a floor. Their surroundings become more luxurious as the organisation becomes less functional.

**Tagline:** _Deliver nothing. Demonstrate everything. Get promoted._

**Audience:** Agile coaches, product managers, engineers and anyone who recognises corporate dysfunction. The humour should be accessible to people outside those professions too.

**Platform:** Desktop-first browser game, single-player, mouse-driven. No account or network connection required for the initial version.

**Target feel:** Wickedly funny, strategically satisfying and recognisable. Players should laugh at choices they have actually seen rewarded in real organisations.

## 2. Design pillars

1. **Be the villain, gleefully.** The player is an amoral career climber, not a frustrated reformer. Ethical options can exist, but the game's reward system celebrates the art of getting ahead.
2. **The tower is the game.** Promotions physically change the accessible environment, people, powers and visual quality of life. Avoid a generic card game with a tower pasted behind it.
3. **Perverse incentives drive the mechanics.** Seemingly damaging behaviour should be instrumentally rational in the right circumstances. The satire comes from the rules, not merely the jokes.
4. **Consequences persist.** Today's triumphant governance reform becomes next quarter's capacity crisis. A player may escape the consequences by being promoted first.
5. **Laugh _and_ strategise.** Choices must have meaningful trade-offs, dependencies and timing. There should be multiple viable routes to success, not one universally correct cynical answer.
6. **Recognisable, not cruel.** Satirise institutions, incentives, leadership clichés and power dynamics. Characters are fictional composites, not thinly disguised real colleagues.

## 3. The office tower

A cross-section/side-on view of a ten-storey corporate headquarters is the main screen. Each floor is a distinct miniature workplace. Elevators, stairs, doors, NPCs and visible office activity make the ascent tangible. Clicking a floor opens its available people, departments, actions and problems.

| Floor | Career stage            | Environment                                       | New opportunity                                            |
| ----- | ----------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| 1     | Junior employee         | Grey cubicles, flickering lights, communal kettle | Take credit, cultivate sponsors, survive reviews           |
| 2     | Team lead               | Slightly larger desk, temperamental printer       | Allocate work, choose what gets reported                   |
| 3     | Middle manager          | First window, tiny meeting room                   | Control staffing, performance ratings and reporting        |
| 4     | Programme manager       | Glass partitions, branded wall decals             | Create programmes, dependencies and steering committees    |
| 5     | Head of transformation  | Innovation lounge, motivational slogans           | Launch methodologies and company-wide initiatives          |
| 6     | Director                | Corner office, executive assistant                | Compete for budgets, restructure departments               |
| 7     | Vice president          | Private conference suite                          | Form alliances, trade favours, manage rivals               |
| 8     | Chief strategy officer  | Artworks and executive dining                     | Set targets, redefine success, hire consultants            |
| 9     | Chief operating officer | Wood panelling, board access                      | Control the entire operating model and succession politics |
| 10    | CEO penthouse           | Panoramic views, marble, private lift             | Win: secure the title, bonus and golden parachute          |

The **visual progression is a major reward**: office size, furniture, clothing, views, number of assistants, and the deference shown by NPCs all increase. Lower floors remain visible and evolve as the player's decisions affect them. A new policy might spawn queues outside meeting rooms; a hiring freeze might leave desks empty; a transformation could cover walls with posters while work piles up.

**Important scope decision:** A 2D illustrated building with animated details is preferable to a 3D world. The game should feel like a lively management sim without requiring pathfinding, full character simulation or expensive art production.

## 4. The core game loop

Each turn represents **one month**. One complete run should eventually take roughly 30–60 minutes; exact pacing must be playtested.

1. **Inspect:** View your floor, your department, political relationships, operational problems and active initiatives. Read the latest executive dashboard (which may differ from reality).
2. **Scheme:** Spend a limited number of management actions (suggested starting point: **three per month**). Actions may involve people, projects, budgets, reporting, policies or personal publicity. Available actions expand with seniority.
3. **React:** A contextual event interrupts: a missed delivery, whistleblower, customer complaint, executive visit, budget fight, audit or rival's manoeuvre. Choose a response.
4. **Simulate:** The company's systems update: staffing, delivery capacity, morale, product quality, reporting burden, financial viability and the effects of earlier decisions.
5. **Spin:** The official corporate narrative is produced. It may bear little relationship to operational reality. The player gains or loses visibility, allies and exposure to blame.
6. **Advance:** At quarterly performance reviews, compete for promotion. Once promoted, ride the elevator to a more luxurious floor and gain new powers while leaving certain problems behind.

The key distinction from a multiple-choice story: **the player makes proactive management decisions on a persistent organisation**, not just replies to a stream of jokes.

## 5. The simulation: two competing realities

### A. Personal success (what wins)

- **Career capital (0–100):** Recognition and promotion progress. The primary career score, earned through conspicuous achievements and sponsorship.
- **Political capital (0–100):** A spendable resource for influencing decisions, securing appointments, suppressing problems or getting allies to take the fall.
- **Blame exposure (0–100):** Risk that an audit, crisis or rival connects the player to a damaging decision. Too high can block promotion, force a demotion or end the run.
- **Perks and bonuses:** Persistent rewards and a satisfying end-game score, rather than another metre to micromanage.

### B. Organisational reality (what the player manipulates)

- **Real delivery capacity:** Work that can genuinely be completed.
- **Reporting/meeting overhead:** Capacity consumed by bureaucracy.
- **Staff morale and retention:** Determines attrition, resistance and the supply of plausible scapegoats.
- **Product/service quality:** Determines defects and customer crises, often with delay.
- **Financial viability:** Keeps the business alive long enough for the player to climb; it is a constraint, **not** the player's objective.

### C. The official story

The visible executive dashboard is **not identical** to the internal state. The player can influence which metrics are chosen, what gets excluded, how results are framed and who is credited. For example, delivery can decline while the dashboard turns greener because teams have redefined 'done', reduced scope, or changed the baseline.

**Core tension:** Optimise personal success while keeping the company _just viable enough_ not to collapse before your next promotion or payout. A collapsing business is not inherently a moral punishment: at the right career stage, a bailout, sale or golden parachute may be another route to victory.

Avoid exposing ten equally important gauges on the main screen. Lead with career capital, political capital, blame exposure and corporate viability; put operational detail in drill-down views.

## 6. Actions: the player's toolkit

Actions should be unlocked by floor and should have both immediate and delayed consequences. Illustrative action families:

| Action family              | Example actions                                                                       | Typical trade-off                                      |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Self-promotion**         | Publish a success story, claim team credit, volunteer for a high-profile presentation | Visibility vs resentment or scrutiny                   |
| **Metric engineering**     | Change definitions, exclude exceptions, select a flattering comparison                | Dashboard improvement vs future credibility risk       |
| **Meeting creation**       | Launch a steering group, add status reporting, create a governance layer              | Executive reassurance vs delivery capacity             |
| **Political manoeuvring**  | Cultivate a sponsor, undermine a rival, trade a favour                                | Promotion leverage vs future obligations               |
| **People management**      | Reward loyal performers, transfer troublesome experts, hire allies                    | Control vs competence and morale                       |
| **Transformation theatre** | Launch a framework, announce a reorganisation, rename a department                    | Career visibility vs confusion and churn               |
| **Budget empire**          | Seek headcount, protect a budget, hire consultants                                    | Departmental prestige vs financial viability           |
| **Crisis management**      | Find a scapegoat, bury a report, stage a rescue programme                             | Escape immediate blame vs larger delayed risk          |
| **Selective competence**   | Quietly fix a genuine problem                                                         | Preserve the business; often less visible than theatre |

Actions should sometimes combine. For instance: **Create Programme → Hire Consultant → Establish Steering Committee → Redefine KPI → Claim Transformation Success**. A good combination is amusing _and_ mechanically useful.

Crucially, effective villainy requires judgement. Hiring consultants every turn should eventually bankrupt you. Taking credit too often should breed enemies. Rigging every metric should eventually make the dashboard useless to its own author.

## 7. Promotions, rivals and politics

Quarterly reviews assess a blend of career capital, executive sponsorship, apparent departmental performance and blame exposure. Requirements become more political higher up the tower. Promotion should not be a simple experience-point threshold: vacancies, rival candidates and reputation matter.

Include a small cast of **persistent fictional NPCs**, each with a role, agenda, influence, opinion of the player and memory of major past interactions:

- **Martin, Transformation Director:** Seven successful transformations; no detectable transformation.
- **Sarah, Product Lead:** Has actual customer evidence and is therefore regularly excluded from decisions.
- **Nigel, Strategy Executive:** Strong sponsor if flattered; dangerous adversary if publicly contradicted.
- **Priya, Engineering Manager:** Keeps the lights on while quietly documenting the damage.
- **Clive, Consultant:** Converts obvious observations into expensive presentation decks.

Relationships matter mechanically. A friendly executive might sponsor a promotion; an alienated engineer might become a whistleblower; a weakened rival may become a convenient scapegoat. NPC reactions should be deterministic or seeded, based on state and personality—not randomly improvised every turn.

## 8. Dysfunction loops: the game engine's signature feature

A **dysfunction loop** is a persistent chain of effects that creates new opportunities for self-serving management. Build the system around a few interacting loops rather than hundreds of disconnected event cards.

**Governance spiral**

More oversight → more reporting overhead → less delivery → worse targets → executive concern → demand for more oversight. The player can earn career capital from each 'response' while the business deteriorates.

**Metric inflation**

Raise targets or redefine measurements → green dashboard → praise and bonuses → reality diverges → a customer or auditor eventually spots the gap. Blame can be transferred if the player prepared a scapegoat.

**Transformation carousel**

Announce transformation → create short-term optimism → interrupt work → results disappoint → argue that the culture resisted change → launch a bigger transformation. A promotion resets the player's personal accountability window.

**Empire-building trap**

Hire reports → gain status and political weight → consume budget → demand more budget to manage the complexity → become 'too important to fail'.

**Talent exodus**

Reward visibility over competence → capable staff leave → quality and delivery deteriorate → hire consultants and impose controls → further demoralise remaining staff.

These loops should leave **visible marks on the floors below**. The player's past should become part of the game's scenery.

## 9. Example emergent story

**Month 2, Floor 1:** The player takes credit for an engineer's automation work and earns the attention of Nigel.

**Month 5, Floor 2:** That engineer distrusts the player. A missed deadline occurs. The player introduces mandatory daily executive reporting and earns praise for 'grip'.

**Month 9, Floor 3:** The reporting burden has reduced throughput. The player proposes a cross-functional Transformation Delivery Office to address the productivity crisis.

**Month 13, Floor 4:** The new office requires a programme manager and an outside consultancy. A giant green dashboard appears on a lower floor, while the actual delivery queue doubles.

**Month 16:** The board applauds the improvement. The player is promoted. An exhausted Priya starts assembling the evidence. She may become a future antagonist—or the next useful scapegoat.

The story is compelling because the consequences were generated from earlier choices, not because the player selected the 'funny' answer on every card.

## 10. Humour, writing and presentation

The voice should be **deadpan corporate sincerity**. The game itself rarely admits anything is absurd; it congratulates the player in the language of leadership competency frameworks.

Example notifications:

- _Your new reporting framework has improved visibility by 34%. Actual delivery is now classified as a legacy metric._
- _Congratulations! You have successfully delegated accountability while retaining strategic ownership._
- _The transformation has failed to achieve its objectives. This demonstrates the urgent need for Phase Two._
- _Staff engagement has declined, but participation in the engagement survey has risen. The dashboard is green._
- _Your former team has missed another deadline. Fortunately, you no longer manage them._

Recurring visual jokes: the same 'transformation' banner is repainted with a new title; the executive floor gains a coffee bar as layoffs hit below; reports travel up the building and instructions travel down. The elevator can announce promotions with overwrought celebration.

Audio, if used, should be optional and subtle: lift chime, printer, keyboard, muffled meetings, applause, notification stings. Accessibility matters: readable text, reduced motion and no reliance on colour alone.

## 11. Interface proposal

**Main view:** Side-on cutaway tower, vertically scrollable. The current floor is emphasised; upper floors are visible but inaccessible. Floors are clickable; people and departments have simple animations.

**Top strip:** Current role, month, career capital, political capital, blame exposure and business viability.

**Right panel:** Selected person/department/initiative and contextual actions. Show costs, immediate likely benefits and known risks. Keep some delayed effects hidden, but make the causal logic learnable.

**Bottom strip:** Corporate news ticker, action log and notifications, e.g. 'Strategic alignment workshop achieves 100% attendance.'

**Overlays:** Executive dashboard (official story), operational truth (unlocked through access), relationships map, quarterly review and promotion ceremony.

**Promotion moment:** The camera follows the elevator rising to a newly unlocked, more opulent floor. Previously managed departments remain below, still reacting to the player's legacy.

Visual direction: playful, readable 2D illustration with exaggerated architecture and restrained animation. Prioritise strong art direction and clear information hierarchy over realistic graphics.

## 12. Victory, defeat and replayability

**Main victory:** Reach Floor 10, acquire the CEO title and secure a personal payout. Final grade reflects floor reached, bonuses extracted, political reach, personal blame avoided and perhaps the spectacular extent of the damage left behind. Organisational wellbeing **does not** contribute positively to the score.

**Possible endings:**

- **Visionary Leader:** Become CEO of a barely functioning enterprise while collecting awards.
- **The Golden Parachute:** Engineer a sale, restructuring or collapse after securing personal protection.
- **Too Big to Fail:** Oversee a disastrous turnaround and emerge as the only person considered qualified to lead the next one.
- **The Scapegoat:** Get blamed and dismissed before reaching the top.
- **The Quietly Competent:** Keep the business healthy but fail to become suitably visible; a tongue-in-cheek, low-scoring outcome.

Replayability comes from different NPC relationships, event timing, organisational starting conditions, strategic combinations and the order in which dysfunction loops compound. Use a **seeded** simulation so runs can be reproduced for testing and shared with colleagues.

## 13. First playable: a deliberately constrained vertical slice

**Do not build all ten floors first.** Build the tower and its visual promise, but fully implement only Floors 1–3. The floors above are visible, locked and tantalising. A short 'Acting Regional Visionary' end-screen can stand in for the final CEO victory until the full game exists.

Suggested playable scope:

- A compelling 2D tower view with three distinct, interactive floors and seven locked preview floors.
- 12 monthly turns, three actions per month, quarterly reviews, promotion to Floors 2 and 3.
- Four prominent indicators: career capital, political capital, blame exposure and company viability.
- Internal state for delivery, overhead, morale, quality and official dashboard narrative.
- 12–18 reusable actions across credit-taking, governance, metric manipulation, political favours, staffing and selective competence.
- Approximately 20–25 **authored event templates**, with conditions and variable text, not 25 unrelated one-off stories.
- Three persistent NPCs to start (e.g. Nigel, Priya and Martin), with relationships and at least one memory-driven consequence each.
- Three implemented dysfunction loops: governance spiral, metric inflation and talent exodus.
- Quarterly promotion mechanics, several failure conditions, event history and a satirical results screen.
- Save/load locally and seed/restart support.

**Vertical-slice success criteria:** A newcomer can understand the goal within two minutes; a 15–25-minute playthrough creates at least one memorable unintended consequence; at least two different strategies can earn promotion; the tower visibly changes due to player actions; the player wants to try another run.

## 14. Build approach for Codex

This is a **game proposal, not a final technical spec**. Codex should first turn the design into explicit rules, content schemas and small implementation tickets. Avoid generating a huge unvalidated codebase in one pass.

**Suggested stack (established tools):** TypeScript + React + Vite for the browser UI; CSS/SVG and modest animation for the 2D tower; a pure TypeScript simulation engine separated from rendering; Vitest for rules tests; Playwright for a small set of end-to-end flows. Use React state or a small state library only if complexity justifies it. No backend needed in the first prototype.

**Recommended architecture:**

- `game/state`: versioned, serialisable GameState, including player, company, floors, NPCs, programmes, active effects, pending events and random seed.
- `game/actions`: declarative, data-driven actions with prerequisites, costs, effects and delayed consequences.
- `game/simulation`: pure `advanceMonth(state, decisions, seed)` logic, quarterly review and promotion resolution.
- `game/events`: authored event templates with trigger predicates, choices, consequences and cooldowns.
- `game/content`: character traits, floor definitions, text and balancing data.
- `ui`: tower view, inspector, dashboards, event modal, review/promotion ceremony, history and results.

**Rules discipline:** Actions must produce clear, testable effects; delayed effects must be explicit and inspectable; state changes should be reproducible with a fixed seed; data content should be editable without code changes; saves should be versioned. Keep a developer/debug view showing the _true_ organisational state and why each modifier fired, even though the player's executive dashboard deliberately distorts reality.

**Milestone sequence:**

1. **Playable skeleton:** Single floor, month advancement, three actions, one event, visible indicators, deterministic save/restart.
2. **Tower and progression:** Three floors, elevator promotion, increasingly luxurious visuals, unlocked powers.
3. **Organisational feedback:** Three dysfunction loops, delayed effects, official dashboard versus operational truth.
4. **Politics and personality:** NPC motives, relationships, favours, betrayals, promotion rivals.
5. **Content and polish:** Authored event pack, dialogue, animations, accessibility, end screens and balance.

**Acceptance tests worth writing early:**

- Same state + same choices + same seed produces the same outcome.
- Advancing a month resolves delayed effects once, in a defined order.
- Governance overhead reduces real capacity, even if the reported dashboard improves.
- A metric redefinition can improve reported results without improving real output.
- A promotion changes the player's floor and powers without erasing lower-floor consequences.
- An NPC remembers a significant prior action and reacts later.
- Company viability reaching a terminal limit triggers a defined outcome.
- A saved game reloads to the identical state and can continue reproducibly.

## 15. Explicit non-goals for version one

- No 3D world, free-roaming avatar or complex pathfinding.
- No multiplayer, accounts, cloud backend or monetisation.
- No live LLM needed during gameplay. Use AI to help _author_ content, not to make core rules unpredictable.
- No attempt to simulate a real business's full finances or labour market.
- No enormous catalogue of procedural jokes before the fundamental loop is fun.
- No moral lecture or secret 'be a good leader' victory condition.

## 16. Open design decisions for playtesting

1. **How visible should hidden consequences be?** Enough information to reward strategy without spoiling surprises.
2. **How much control per floor?** Junior actions must remain satisfying; higher-floor powers should feel transformational rather than just numerically larger.
3. **How quickly should promotion happen?** The tower must deliver visual rewards frequently without making career ascent trivial.
4. **How close to collapse can the business get?** Players need room for spectacular mismanagement without premature game-over becoming frustrating.
5. **How much dialogue versus systems?** Character comedy should add flavour, but the management simulation must carry the game.

## 17. Suggested next instruction for Codex

> Use this proposal as the product vision for a browser-based game called _Failureship_. Do **not** implement the whole proposal immediately. First identify ambiguities and propose a minimal deterministic simulation model, the GameState schema, the monthly turn sequence, promotion rules, and a small data-driven action/event format. Then create a staged implementation plan with independently testable tickets, starting with one playable floor and progressing toward a three-floor vertical slice. Preserve the satirical premise: the player wins by mastering perverse organisational incentives, not by improving the company. Keep the building visually central and distinguish reported metrics from real outcomes.

---

**Creative north star:** _The funniest playthrough is one in which the player climbs into an increasingly magnificent office while the increasingly absurd consequences of their earlier decisions pile up on the floors below._
