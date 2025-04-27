let stopExecution = false;

export function getStopExecution() {
  return stopExecution;
}

export function setStopExecution(newStopExecution: boolean) {
  stopExecution = newStopExecution;
}
