const path = require('path');
const replayFile = path.join(__dirname, '2p__Tombs_of_Kesorak_Turn_4_(93498)');

// In real scenario, this would be:
// const { parseRankedReplay } = require('./backend/dist/utils/replayRankedParser');

// Since we need to test the compiled version
const { parseRankedReplay } = require('./backend/dist/utils/replayRankedParser');

(async () => {
  try {
    const result = await parseRankedReplay(replayFile);
    console.log('\n✅ FULL PARSE RESULT:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ PARSE FAILED:', err.message);
  }
})();
