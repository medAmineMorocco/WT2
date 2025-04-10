let logStates: any[] = [];

let stopExecution = false;

let worktreesStates: any[] = [];

export function getLogStates() {
  return logStates;
}

export function setLogStates(newLogStates: any[]) {
  logStates = newLogStates;
}

export function getStopExecution() {
  return stopExecution;
}

export function setStopExecution(newStopExecution: boolean) {
  stopExecution = newStopExecution;
}

export function getWorktreesStates() {
  return worktreesStates;
}

export function setWorktreesStates(newWorktreesStates: any[]) {
  worktreesStates = newWorktreesStates;
}
