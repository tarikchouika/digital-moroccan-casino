const BR = require('../js/games/billiards-rules.js');
for (const id of ['eightball','blackball','snooker','carom']) {
  const G = BR[id]({});
  try {
    const plan = G.aiPlan();
    console.log(id, 'plan=', JSON.stringify(plan), 'phase=', G.S.phase, 'hist=', G.S.history.length);
  } catch (e) { console.log(id, 'ERR', e.message, e.stack.split('\n')[1]); }
}
