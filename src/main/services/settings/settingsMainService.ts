const { execSync } = require('child_process');

const supportedTerminals = [
  {
    label: 'Cmd',
    whereCommand: 'where cmd',
  },
  {
    label: 'Git Bash',
    whereCommand: 'where bash',
  },
  {
    label: 'PowerShell',
    whereCommand: 'where powershell',
  },
];

function where(command: string) {
  const stdout = execSync(command);

  const lines = stdout.toString().trim().split('\n');
  if (lines.length > 0) {
    return lines[0].trim();
  }
  throw new Error('not found');
}

function getTerminals() {
  const terminals: any[] = [];
  supportedTerminals.forEach((supportedTerminal) => {
    try {
      const path = where(supportedTerminal.whereCommand);
      terminals.push({
        label: supportedTerminal.label,
        path,
        supported: true,
      });
    } catch (err) {
      terminals.push({
        label: supportedTerminal.label,
        supported: false,
      });
    }
  });
  return terminals;
}

export default {
  getTerminals,
};
