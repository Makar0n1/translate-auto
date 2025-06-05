const translationStates = new Map();

exports.setTranslationState = (projectId, isRunning) => {
  console.log(`Setting translation state for project ${projectId}: ${isRunning}`);
  translationStates.set(projectId, isRunning);
};

exports.getTranslationState = (projectId) => {
  return translationStates.get(projectId) || false;
};