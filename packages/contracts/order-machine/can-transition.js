const { TRANSITIONS } = require("./transitions");

function findTransition(fromStatus, event) {
  return TRANSITIONS.find((row) => {
    return row.from === fromStatus && row.event === event;
  });
}

function canTransition(fromStatus, event) {
  return Boolean(findTransition(fromStatus, event));
}

module.exports = { findTransition, canTransition };
