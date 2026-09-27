// Tech Lens: for every event type, which technology it shows, what happened in plain English,
// and what that looks like in a client's business. Templated on purpose: instant, free, never made up.
export const TECH = {
  game: { label: 'Game', icon: 'M4 4h16v16H4z' },
  n8n: { label: 'n8n', icon: 'M5 12h4l3-6 3 12 3-6h2' },
  agent: { label: 'AI', icon: 'M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z' },
  oracle: { label: 'Oracle', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v4l3 2' },
  chain: { label: 'Chain', icon: 'M9 7H6a5 5 0 000 10h3M15 7h3a5 5 0 010 10h-3M8 12h8' },
  weather: { label: 'Weather', icon: 'M7 17h10a4 4 0 00.5-7.97A6 6 0 006.2 10.1 3.5 3.5 0 007 17z' },
};

export const LENS = {
  'turn.started': ['game', 'A new turn began. The world keeps its own clock, so nobody has to press a button.', 'A scheduler that starts your billing run or daily report on time, every time.'],
  'resources.updated': ['game', "The kingdom's books were updated: income collected, food eaten, stock adjusted.", 'Stock and cash positions that update themselves after every sale or delivery.'],
  'army.moved': ['game', "The general's order was carried out: the army marched and claimed land on the way.", 'An approved decision flowing straight into operations, like dispatch routing a driver.'],
  'army.held': ['game', 'The general chose to wait. Doing nothing is a decision too, and it is recorded.', "An approval flow that logs 'no change needed', so the audit trail has no gaps."],
  'army.fortified': ['game', 'The army dug in: stronger defence until its next turn, plus a little healing.', 'Adding capacity or security ahead of a predicted busy period.'],
  'army.recruited': ['game', "Gold was spent to hire soldiers on the kingdom's own land, at a price set by the real LINK market.", "A purchase the system allows only when budget rules are met, at today's market price, with no manual policing."],
  'army.starving': ['game', 'Food ran out, so the army weakens every turn until supplies arrive.', 'What happens when stock runs out: service degrades until someone reorders. That is why automations exist.'],
  'army.routed': ['game', 'The army broke and fled home. It regroups at the capital after two turns.', 'A clean failover: when something breaks, it restarts from a known safe point.'],
  'battle.resolved': ['game', 'A battle was settled by fixed rules plus a dice roll seeded from the turn number, so anyone can replay it and get the same result.', 'Transparent, repeatable calculations, like a pricing or credit rule you can audit line by line.'],
  'stronghold.captured': ['game', 'A stronghold changed hands. That automatically triggers a permanent record on the blockchain.', 'A key event, like a signed contract or a delivered shipment, that sets off downstream records on its own.'],
  'season.started': ['game', "A new season began, fought under a new city's real sky. Each general carries its lessons from the last season in memory.", 'Planning the next quarter from what last quarter taught you, automatically.'],
  'season.ended': ['game', 'The season is over. The result goes to the public ledger and a new season starts by itself.', 'Month-end close: results locked, recorded, and the next period opened with no manual work.'],
  'turn.timeout': ['game', 'No order arrived in time, so the world applied a safe default and kept going.', 'A timeout with a fallback: if a supplier system is down, yours uses a safe default instead of freezing.'],

  'n8n.workflow_started': ['n8n', 'An automation noticed something happened and started the right process on its own.', 'When a form is submitted, the CRM entry, invoice and welcome email all happen automatically.'],
  'n8n.threshold_alert': ['n8n', 'Food dropped below 20%, so an automation called the quartermaster and reordered supplies.', 'Stock below minimum triggers a reorder and a Slack alert.'],
  'n8n.workflow_finished': ['n8n', "The automation delivered the general's order to the game and finished its run.", 'An integration that carries a decision from one system into another, with no copy-paste.'],
  'n8n.news_posted': ['n8n', 'An automation turned a key moment into a Discord post, so people who are not watching still hear about it.', 'The event that updates your system also tells your team or customers on Slack, Discord or email.'],
  'n8n.unreachable': ['n8n', 'The automation server did not answer, so the world ran this turn itself and logged the gap.', 'Graceful degradation: when one tool is down, the business keeps running and the gap is recorded.'],

  'agent.thinking_started': ['agent', 'An AI general received the turn and started working out what to do.', 'An AI assistant picking up a new ticket, order or request.'],
  'agent.thought': ['agent', 'The AI said what it was thinking, in plain words, before acting.', 'An assistant that tells you why it is doing something, not just what.'],
  'agent.tool_called': ['agent', 'The AI general asked for information before deciding, like a manager checking a report.', 'An AI assistant that checks your inventory before placing an order.'],
  'agent.tool_result': ['agent', "The game answered the AI's question with real data, so it is not guessing.", 'Your AI reading live numbers from your own systems instead of making them up.'],
  'agent.decision': ['agent', 'The AI made its decision. The game checks it against the rules before anything happens.', 'An AI that drafts the action while your system enforces the rules and limits.'],
  'agent.memory_written': ['agent', 'The AI wrote a note in its journal, so next turn it remembers what it planned.', "An assistant that remembers each customer's history between conversations."],
  'agent.fallback': ['agent', "The AI was unavailable (free quota or rate limit), so standing orders (simple rules) took over. It's labelled honestly.", 'A cost cap: when the AI budget is reached, a cheaper rule-based process takes over.'],
  'agent.lesson': ['agent', 'At season end each general wrote down one lesson to carry into the next season.', "A system that learns from last month's results and adjusts next month's plan."],

  'oracle.price_update': ['oracle', 'Real ETH, BTC and LINK prices were brought in from outside the game by Chainlink.', 'Your contracts or apps react to live exchange rates, weather or shipping data.'],
  'market.shift': ['oracle', "A real price's trend this season moved enough to matter. Each kingdom's fighting spirit follows its coin (Emberreach: ETH, Frostmere: BTC), its treasury gains or loses gold with every move, and LINK sets the price of soldiers for both.", 'Prices, payouts or budgets that adjust themselves to a live market rate.'],
  'weather.changed': ['weather', "The real weather over this season's city changed, and the battlefield changed with it: rain turns roads to mud, fog blinds scouts, storms blunt attacks, snow and heat make armies hungrier.", 'Operations that adapt to live conditions: delivery routes around storms, staffing that follows the forecast.'],

  'chain.tx_queued': ['chain', 'A record is waiting in the outbox to be written to the blockchain. If the network is slow it retries, so nothing is lost.', 'A reliable outbox: every invoice or certificate is guaranteed to go out, even if a service blips.'],
  'chain.tx_sent': ['chain', 'The record was signed and sent to the public blockchain network.', 'Submitting a filing to an official registry.'],
  'chain.tx_confirmed': ['chain', 'The capture was written to a public ledger. Nobody, including the builder, can edit it.', 'Tamper-proof records for certificates, supply chain or payouts.'],
  'chain.tx_failed': ['chain', 'Writing to the blockchain failed. The game carries on and the failure is shown openly.', 'Error handling you can see: failures are flagged, not hidden.'],
};
